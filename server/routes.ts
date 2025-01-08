import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { shifts, swapRequests, providers, timeOffRequests, holidays } from "@db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { setupWebSocket, notify } from "./websocket";

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

  const httpServer = createServer(app);
  const { broadcast } = setupWebSocket(httpServer);

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

      // Broadcast notification
      broadcast(notify.shiftCreated(result[0], provider[0]));

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

      // Get provider info for notification
      const provider = await db.select()
        .from(providers)
        .where(eq(providers.id, result[0].providerId))
        .limit(1);

      if (provider.length) {
        broadcast(notify.shiftUpdated(result[0], provider[0]));
      }

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to update shift",
        error: error.message 
      });
    }
  });

  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Get shift and provider info before deletion for notification
      const shift = await db.select()
        .from(shifts)
        .where(eq(shifts.id, parseInt(id)))
        .limit(1);

      if (!shift.length) {
        res.status(404).json({ message: "Shift not found" });
        return;
      }

      const provider = await db.select()
        .from(providers)
        .where(eq(providers.id, shift[0].providerId))
        .limit(1);

      // Delete the shift
      await db.delete(shifts).where(eq(shifts.id, parseInt(id)));

      if (provider.length) {
        broadcast(notify.shiftDeleted(shift[0], provider[0]));
      }

      res.json({ message: "Shift deleted successfully" });
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to delete shift",
        error: error.message
      });
    }
  });

  app.post("/api/swap-requests", async (req, res) => {
    try {
      const { requestorId, recipientId, shiftId } = req.body;

      // Check if there's already a pending request for this shift
      const existingRequest = await db.select()
        .from(swapRequests)
        .where(
          and(
            eq(swapRequests.shiftId, shiftId),
            eq(swapRequests.status, 'pending')
          )
        );

      if (existingRequest.length > 0) {
        res.status(400).json({ message: "A pending swap request already exists for this shift" });
        return;
      }

      const result = await db.insert(swapRequests).values({
        requestorId,
        recipientId,
        shiftId,
        status: 'pending'
      }).returning();

      // Get provider info for notification
      const [requestor, recipient, shift] = await Promise.all([
        db.select().from(providers).where(eq(providers.id, requestorId)).limit(1),
        db.select().from(providers).where(eq(providers.id, recipientId)).limit(1),
        db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1),
      ]);

      if (requestor.length && recipient.length && shift.length) {
        broadcast(notify.shiftSwapRequested(
          shift[0],
          requestor[0],
          recipient[0],
          result[0].id // Include the swap request ID
        ));
      }

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to create swap request",
        error: error.message
      });
    }
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

  app.patch("/api/swap-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['accepted', 'rejected'].includes(status)) {
        res.status(400).json({ message: "Invalid status" });
        return;
      }

      // Get swap request details
      const swapRequest = await db.select()
        .from(swapRequests)
        .where(eq(swapRequests.id, parseInt(id)))
        .limit(1);

      if (!swapRequest.length) {
        res.status(404).json({ message: "Swap request not found" });
        return;
      }

      const request = swapRequest[0];

      // Verify the request is still pending
      if (request.status !== 'pending') {
        res.status(400).json({ message: "This request has already been processed" });
        return;
      }

      // Update swap request status
      await db.update(swapRequests)
        .set({ status })
        .where(eq(swapRequests.id, parseInt(id)));

      // If accepted, update shift provider
      if (status === 'accepted') {
        // Get the shift to validate
        const shiftToSwap = await db.select()
          .from(shifts)
          .where(eq(shifts.id, request.shiftId))
          .limit(1);

        if (!shiftToSwap.length) {
          res.status(404).json({ message: "Shift not found" });
          return;
        }

        // Check if the shift still belongs to the requestor
        if (shiftToSwap[0].providerId !== request.requestorId) {
          res.status(400).json({ message: "Shift no longer belongs to the requestor" });
          return;
        }

        // Update the shift
        await db.update(shifts)
          .set({ 
            providerId: request.recipientId,
            status: 'swapped'
          })
          .where(eq(shifts.id, request.shiftId));
      }

      // Get provider info for notification
      const [requestor, recipient, shift] = await Promise.all([
        db.select().from(providers).where(eq(providers.id, request.requestorId)).limit(1),
        db.select().from(providers).where(eq(providers.id, request.recipientId)).limit(1),
        db.select().from(shifts).where(eq(shifts.id, request.shiftId)).limit(1),
      ]);

      if (requestor.length && recipient.length && shift.length) {
        broadcast(notify.shiftSwapResponded(
          shift[0],
          requestor[0],
          recipient[0],
          status
        ));
      }

      res.json({ message: `Swap request ${status}` });
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to update swap request",
        error: error.message
      });
    }
  });

  return httpServer;
}