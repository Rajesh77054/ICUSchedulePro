import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { shifts, swapRequests, providers, timeOffRequests, holidays } from "@db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";

// Initialize providers if they don't exist
const initializeProviders = async () => {
  const defaultProviders = [
    {
      id: 1,
      name: "Ashley Liou",
      title: "MD",
      targetDays: 105,
      tolerance: 7,
      maxConsecutiveWeeks: 1,
      color: "hsl(230, 75%, 60%)",
    },
    {
      id: 2,
      name: "Joseph Brading",
      title: "MD", 
      targetDays: 170,
      maxConsecutiveWeeks: 2,
      color: "hsl(160, 75%, 40%)",
    },
    {
      id: 3,
      name: "Rajesh Harrykissoon",
      title: "MD",
      targetDays: 62,
      maxConsecutiveWeeks: 1,
      color: "hsl(350, 75%, 50%)",
    },
    {
      id: 4, 
      name: "Anthony Zachria",
      title: "DO",
      targetDays: 28,
      maxConsecutiveWeeks: 1,
      color: "hsl(45, 75%, 45%)",
    },
  ];

  for (const provider of defaultProviders) {
    await db.insert(providers).values(provider).onConflictDoNothing();
  }
};

export function registerRoutes(app: Express): Server {
  // Initialize providers when the server starts
  initializeProviders().catch(console.error);

  app.get("/api/shifts", async (req, res) => {
    const { start, end } = req.query;
    let query = db.select().from(shifts);

    if (start && end) {
      query = query.where(
        and(
          gte(shifts.startDate, start as string),
          lte(shifts.endDate, end as string)
        )
      );
    }

    const results = await query;
    res.json(results);
  });

  app.post("/api/shifts", async (req, res) => {
    try {
      const { providerId, startDate, endDate } = req.body;

      // Validate provider exists
      const provider = await db.select()
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);

      if (!provider.length) {
        res.status(400).json({ 
          message: "Invalid provider ID",
          error: "Provider not found" 
        });
        return;
      }

      const result = await db.insert(shifts).values({
        providerId,
        startDate,
        endDate,
        status: 'confirmed'
      }).returning();
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to create shift",
        error: error.message 
      });
    }
  });

  app.patch("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.body;

      const result = await db.update(shifts)
        .set({
          startDate,
          endDate,
        })
        .where(eq(shifts.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        res.status(404).json({ message: "Shift not found" });
        return;
      }

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to update shift",
        error: error.message 
      });
    }
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