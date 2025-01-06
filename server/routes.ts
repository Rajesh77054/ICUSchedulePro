import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { shifts, swapRequests, providers, timeOffRequests, holidays } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  app.get("/api/shifts", async (req, res) => {
    const { start, end } = req.query;
    let query = db.select().from(shifts);
    
    if (start && end) {
      query = query.where(
        and(
          gte(shifts.startDate, new Date(start as string)),
          lte(shifts.endDate, new Date(end as string))
        )
      );
    }
    
    const results = await query;
    res.json(results);
  });

  app.post("/api/shifts", async (req, res) => {
    const { providerId, startDate, endDate } = req.body;
    const result = await db.insert(shifts).values({
      providerId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    }).returning();
    res.json(result[0]);
  });

  app.post("/api/swap-requests", async (req, res) => {
    const { requestorId, recipientId, shiftId } = req.body;
    const result = await db.insert(swapRequests).values({
      requestorId,
      recipientId,
      shiftId,
    }).returning();
    res.json(result[0]);
  });

  app.get("/api/swap-requests", async (req, res) => {
    const { providerId } = req.query;
    let query = db.select().from(swapRequests);
    
    if (providerId) {
      query = query.where(
        or(
          eq(swapRequests.requestorId, parseInt(providerId as string)),
          eq(swapRequests.recipientId, parseInt(providerId as string))
        )
      );
    }
    
    const results = await query;
    res.json(results);
  });

  const httpServer = createServer(app);
  return httpServer;
}
