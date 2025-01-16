import express from 'express';
import { Server } from 'http';
import { db } from '../db';
import { providers, shifts, users } from '@db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';
import passport from 'passport';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { isAuthenticated, hasRole } from './auth';
import bcrypt from 'bcryptjs';

export function registerRoutes(app: express.Application) {
  const server = new Server(app);
  const { broadcast } = setupWebSocket(server);
  const MemoryStoreSession = MemoryStore(session);

  // Session middleware
  app.use(session({
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, title, role = 'provider', providerType = 'physician' } = req.body;

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const [user] = await db.insert(users)
        .values({
          email,
          password: hashedPassword,
          role,
        })
        .returning();

      // If user is a provider, create provider record
      if (role === 'provider') {
        await db.insert(providers)
          .values({
            userId: user.id,
            name,
            title,
            providerType,
          });
      }

      res.json({ message: 'Registration successful' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/auth/me', isAuthenticated, async (req, res) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
        with: {
          provider: true,
        },
      });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Protected routes
  app.get("/api/providers", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.query.providers.findMany({
        with: {
          user: true
        }
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/shifts", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.query.shifts.findMany({
        with: {
          provider: true
        }
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all shifts (admin only)
  app.delete("/api/shifts", hasRole(['admin']), async (_req, res) => {
    try {
      const allShifts = await db.query.shifts.findMany({
        with: {
          provider: true
        }
      });

      await db.delete(shifts);

      for (const shift of allShifts) {
        if (shift.provider) {
          broadcast(notify.shiftDeleted(shift, {
            name: shift.provider.name,
            title: shift.provider.title
          }));
        }
      }

      res.json({ message: `Successfully cleared ${allShifts.length} shifts` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shift (scheduler and admin only)
  app.post("/api/shifts", hasRole(['admin', 'scheduler']), async (req, res) => {
    try {
      const { providerId, startDate, endDate } = req.body;

      const provider = await db.query.providers.findFirst({
        where: eq(providers.id, providerId)
      });

      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      const [shift] = await db.insert(shifts)
        .values({
          providerId,
          startDate,
          endDate,
          status: 'confirmed',
          source: 'manual'
        })
        .returning();

      broadcast(notify.shiftCreated(shift, {
        name: provider.name,
        title: provider.title
      }));

      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calendar export
  app.get('/api/schedules/export/:providerId?', isAuthenticated, async (req, res) => {
    try {
      const { providerId } = req.params;
      let query = db.select().from(shifts);

      if (providerId && providerId !== 'all') {
        query = query.where(eq(shifts.providerId, parseInt(providerId)));
      }

      const shifts = await query;

      // Generate iCal format
      const ical = generateICalendar(shifts);

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename=schedule.ics');
      res.send(ical);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return server;
}

// Helper function to generate iCal format
function generateICalendar(shifts: any[]) {
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ICU Scheduler//EN'
  ];

  shifts.forEach(shift => {
    ical = ical.concat([
      'BEGIN:VEVENT',
      `UID:${shift.id}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${new Date(shift.startDate).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${new Date(shift.endDate).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:ICU Shift - ${shift.provider?.name || 'Unassigned'}`,
      'END:VEVENT'
    ]);
  });

  ical.push('END:VCALENDAR');
  return ical.join('\r\n');
}