import express, { Express } from 'express';
import { db } from '../db';
import { and, eq } from "drizzle-orm";
import { shifts, users, swapRequests, userPreferences } from '../db/schema'; // Added import for userPreferences
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const log = console.log; // Added for clarity


export function registerRoutes(app: Express) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          // Filter sensitive data before logging
          const sanitizedResponse = Array.isArray(capturedJsonResponse) 
            ? capturedJsonResponse.map(item => ({...item, password: undefined}))
            : {...capturedJsonResponse, password: undefined};
          logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
        }

        if (logLine.length > 200) {
          logLine = logLine.slice(0, 199) + "…";
        }

        log(logLine);
      }
    });

    next();
  });
  app.get('/api/shifts', async (req, res) => {
    try {
      const allShifts = await db.select().from(shifts);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('ETag', Date.now().toString());
      res.json(allShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({ error: 'Failed to fetch shifts' });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const userMessage = req.body.message;
      const openaiHandler = req.app.get('openaiHandler');

      if (!openaiHandler) {
        throw new Error('OpenAI handler not initialized');
      }

      // Fetch current context data
      const shiftsList = await db.select().from(shifts);
      const usersList = await db.select().from(users);

      const response = await openaiHandler.handleChat(userMessage, {
        shifts: shiftsList,
        users: usersList,
        currentPage: req.body.currentPage || 'unknown'
      });
      res.json({ content: response });
    } catch (error) {
      console.error('Error handling chat request:', error);
      res.status(500).json({ 
        content: "An error occurred while processing your request.",
        error: error.message 
      });
    }
  });

  // Chat room endpoints
  app.get('/api/chat/rooms/:roomId', async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const room = await db.query.chatRooms.findFirst({
        where: (rooms, { eq }) => eq(rooms.id, roomId),
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      // Format the response
      const formattedRoom = {
        id: room.id,
        name: room.name,
        type: room.type,
        members: room.members.map(member => ({
          id: member.user.id,
          name: member.user.name,
          title: member.user.title
        }))
      };

      res.json(formattedRoom);
    } catch (error) {
      console.error('Error fetching chat room:', error);
      res.status(500).json({ error: 'Failed to fetch chat room' });
    }
  });

  app.get('/api/chat/rooms/:roomId/messages', async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const messages = await db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.roomId, roomId),
        with: {
          sender: true
        },
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      const formattedMessages = messages.map(message => ({
        id: message.id,
        content: message.content,
        sender: {
          name: message.sender.name,
          title: message.sender.title
        },
        messageType: message.type,
        metadata: message.metadata,
        createdAt: message.createdAt
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Analytics endpoints
  app.get('/api/analytics/workload', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      // Group shifts by user and calculate total hours
      const userHours = allShifts.reduce((acc, shift) => {
        const startDate = new Date(shift.startDate);
        const endDate = new Date(shift.endDate);
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        if (!acc[shift.userId]) {
          acc[shift.userId] = { hours: 0, target: 160 }; // 160 hours per month (40 hours/week)
        }
        acc[shift.userId].hours += hours;
        return acc;
      }, {});

      const allUsers = await db.select().from(users);
      const hoursDistribution = Object.entries(userHours).map(([userId, data]) => {
        const user = allUsers.find(u => u.id === parseInt(userId));
        const now = new Date();
        const userShifts = allShifts.filter(s => s.userId === parseInt(userId));

        const workedShifts = userShifts.filter(s => new Date(s.startDate) <= now);
        const upcomingShifts = userShifts.filter(s => new Date(s.startDate) > now);

        const workedHours = workedShifts.reduce((acc, shift) => {
          const hours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0);

        const upcomingHours = upcomingShifts.reduce((acc, shift) => {
          const hours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0);

        const workedDays = Math.ceil(workedHours / 8);
        const upcomingDays = Math.ceil(upcomingHours / 8);

        return {
          name: user?.name?.split(' ')[0] || `User ${userId}`,
          workedHours: Math.round(workedHours),
          upcomingHours: Math.round(upcomingHours),
          targetHours: data.target,
          workedDays,
          upcomingDays,
          targetDays: 20,
          workedShifts: workedShifts.length,
          upcomingShifts: upcomingShifts.length,
          targetShifts: 15
        };
      });

      res.json({ hoursDistribution });
    } catch (error) {
      console.error('Error fetching workload data:', error);
      res.status(500).json({ error: 'Failed to fetch workload data' });
    }
  });

  app.get('/api/analytics/fatigue', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      const fatigueMetrics = allShifts.map(shift => ({
        date: shift.startDate,
        consecutiveShifts: 1, // Example metric
        restHours: 24 // Example metric
      }));

      res.json({ fatigueMetrics });
    } catch (error) {
      console.error('Error fetching fatigue data:', error);
      res.status(500).json({ error: 'Failed to fetch fatigue data' });
    }
  });

  app.get('/api/analytics/distribution', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      const fairnessMetrics = allShifts.reduce((acc, shift) => {
        const existingMetric = acc.find(m => m.name === `User ${shift.userId}`);
        if (existingMetric) {
          existingMetric.value += 1;
        } else {
          acc.push({ name: `User ${shift.userId}`, value: 1 });
        }
        return acc;
      }, []);

      res.json({ fairnessMetrics });
    } catch (error) {
      console.error('Error fetching distribution data:', error);
      res.status(500).json({ error: 'Failed to fetch distribution data' });
    }
  });

  app.get('/api/user-preferences/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userPreferences = await db.query.userPreferences.findFirst({
        where: (preferences, { eq }) => eq(preferences.userId, userId)
      });
      res.json(userPreferences || {});
    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.patch('/api/user-preferences/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const updates = req.body;

      // First check if preferences exist
      const existing = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

      let result;
      const values = {
        userId,
        preferredShiftLength: Number(updates.preferredShiftLength) || 7,
        maxShiftsPerWeek: Number(updates.maxShiftsPerWeek) || 1,
        minDaysBetweenShifts: Number(updates.minDaysBetweenShifts) || 0,
        preferredDaysOfWeek: Array.isArray(updates.preferredDaysOfWeek) ? updates.preferredDaysOfWeek.map(Number) : [],
        avoidedDaysOfWeek: Array.isArray(updates.avoidedDaysOfWeek) ? updates.avoidedDaysOfWeek.map(Number) : [],
        updatedAt: new Date()
      };

      if (existing.length > 0) {
        // Update existing preferences
        result = await db
          .update(userPreferences)
          .set({
            ...values,
            updatedAt: new Date()
          })
          .where(eq(userPreferences.userId, userId))
          .returning({
            id: userPreferences.id,
            userId: userPreferences.userId,
            preferredShiftLength: userPreferences.preferredShiftLength,
            maxShiftsPerWeek: userPreferences.maxShiftsPerWeek,
            minDaysBetweenShifts: userPreferences.minDaysBetweenShifts,
            preferredDaysOfWeek: userPreferences.preferredDaysOfWeek,
            avoidedDaysOfWeek: userPreferences.avoidedDaysOfWeek,
            createdAt: userPreferences.createdAt,
            updatedAt: userPreferences.updatedAt
          });
      } else {
        // Create new preferences
        result = await db
          .insert(userPreferences)
          .values({
            ...values,
            createdAt: new Date()
          })
          .returning({
            id: userPreferences.id,
            userId: userPreferences.userId,
            preferredShiftLength: userPreferences.preferredShiftLength,
            maxShiftsPerWeek: userPreferences.maxShiftsPerWeek,
            minDaysBetweenShifts: userPreferences.minDaysBetweenShifts,
            preferredDaysOfWeek: userPreferences.preferredDaysOfWeek,
            avoidedDaysOfWeek: userPreferences.avoidedDaysOfWeek,
            createdAt: userPreferences.createdAt,
            updatedAt: userPreferences.updatedAt
          });
      }

      if (!result.length) {
        return res.status(404).json({ error: 'Failed to update preferences' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences: ' + error.message });
    }
  });

  app.post('/api/shifts', async (req, res) => {
    try {
      const { userId, startDate, endDate, status, source, schedulingNotes } = req.body;

      const newShift = await db.insert(shifts).values({
        userId: parseInt(userId),
        startDate,
        endDate,
        status: status || 'confirmed',
        source: source || 'manual',
        schedulingNotes: schedulingNotes || {},
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      res.json(newShift[0]);
    } catch (error) {
      console.error('Error creating shift:', error);
      res.status(500).json({ error: 'Failed to create shift' });
    }
  });

  app.delete('/api/shifts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // First delete associated swap requests
      await db.delete(swapRequests).where(eq(swapRequests.shiftId, id));

      // Then delete the shift
      await db.delete(shifts).where(eq(shifts.id, id));

      res.status(200).json({ message: 'Shift deleted successfully' });
    } catch (error) {
      console.error('Error deleting shift:', error);
      res.status(500).json({ error: 'Failed to delete shift' });
    }
  });

  app.put('/api/shifts/:id', async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      if (isNaN(shiftId)) {
        throw new Error('Invalid shift ID');
      }
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        throw new Error('Missing required fields');
      }
      const updatedShift = await db.update(shifts)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(shifts.id, shiftId))
        .returning();
      res.status(200).json(updatedShift[0]);
    } catch (error) {
      console.error('Error updating shift:', error);
      res.status(500).json({ error: 'Failed to update shift: ' + error.message });
    }
  });

  return app;
}