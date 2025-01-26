import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from '../db';
import { users, shifts, userPreferences, timeOffRequests, swapRequests } from '@db/schema';
import { and, eq, sql, or } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';

export function registerRoutes(app: Express): Server {
  const server = createServer(app);
  const { broadcast } = setupWebSocket(server);

  // Swap Request Routes
  app.get("/api/swap-requests", async (req, res) => {
    try {
      const { userId } = req.query;

      const requests = await db.query.swapRequests.findMany({
        where: userId ?
          or(
            eq(swapRequests.requestorId, parseInt(userId as string)),
            eq(swapRequests.recipientId, parseInt(userId as string))
          )
          : undefined,
        with: {
          shift: true,
          requestor: {
            columns: {
              name: true,
              title: true,
              color: true,
              userType: true
            }
          },
          recipient: {
            columns: {
              name: true,
              title: true,
              color: true,
              userType: true
            }
          }
        }
      });

      res.json(requests);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get all shifts
  app.get("/api/shifts", async (_req, res) => {
    try {
      const allShifts = await db.select().from(shifts);
      res.json(allShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch shifts' });
    }
  });

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch users' });
    }
  });

  return server;
}