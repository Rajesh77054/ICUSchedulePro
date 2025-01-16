import express from 'express';
import { Server } from 'http';
import { db } from '../db';
import { users, shifts } from '@db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';

export function registerRoutes(app: express.Application) {
  const server = new Server(app);
  const { broadcast } = setupWebSocket(server);

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const result = await db.query.users.findMany();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all shifts
  app.get("/api/shifts", async (_req, res) => {
    try {
      const result = await db.query.shifts.findMany({
        with: {
          user: true
        }
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all shifts
  app.delete("/api/shifts", async (_req, res) => {
    try {
      // Get all shifts with their users for notification
      const allShifts = await db.query.shifts.findMany({
        with: {
          user: true
        }
      });

      // Delete all shifts
      await db.delete(shifts);

      // Notify about each deletion
      for (const shift of allShifts) {
        if (shift.user) {
          broadcast(notify.shiftDeleted(shift, {
            name: shift.user.name,
            title: shift.user.title
          }));
        }
      }

      res.json({ message: `Successfully cleared ${allShifts.length} shifts` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shift
  app.post("/api/shifts", async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.body;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [shift] = await db.insert(shifts)
        .values({
          userId,
          startDate,
          endDate,
          status: 'confirmed',
          source: 'manual'
        })
        .returning();

      broadcast(notify.shiftCreated(shift, {
        name: user.name,
        title: user.title
      }));

      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return server;
}