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

  // Get duplicate shifts for a provider
  app.get("/api/shifts/duplicates/:providerId", async (req, res) => {
    try {
      const providerId = parseInt(req.params.providerId);
      const duplicates = await db.query.shifts.findMany({
        where: and(
          eq(shifts.providerId, providerId),
          sql`EXISTS (
            SELECT 1 FROM shifts s2 
            WHERE s2.provider_id = ${providerId}
            AND s2.start_date = shifts.start_date 
            AND s2.end_date = shifts.end_date
            AND s2.id > shifts.id
          )`
        ),
        with: {
          provider: true
        }
      });

      res.json(duplicates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove duplicate shift
  app.delete("/api/shifts/:shiftId", async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId);

      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
        with: {
          provider: true
        }
      });

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      await db.delete(shifts).where(eq(shifts.id, shiftId));

      broadcast(notify.shiftDeleted(shift, {
        name: shift.provider.name,
        title: shift.provider.title
      }));

      res.json({ message: "Shift deleted successfully" });
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