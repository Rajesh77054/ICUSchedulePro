import express from 'express';
import { Server } from 'http';
import { db } from '../db';
import { providers, shifts } from '@db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';

export function registerRoutes(app: express.Application) {
  const server = new Server(app);
  const { broadcast } = setupWebSocket(server);

  // Get all providers
  app.get("/api/providers", async (_req, res) => {
    try {
      const result = await db.query.providers.findMany();
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
          provider: true
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
      // Get all shifts with their providers for notification
      const allShifts = await db.query.shifts.findMany({
        with: {
          provider: true
        }
      });

      // Delete all shifts
      await db.delete(shifts);

      // Notify about each deletion
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


  // Create new shift
  app.post("/api/shifts", async (req, res) => {
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

  return server;
}