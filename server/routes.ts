import express from 'express';
import { Server } from 'http';
import { db } from '../db';
import { providers, shifts } from '@db/schema';
import { and, eq } from 'drizzle-orm';
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