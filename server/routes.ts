import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { shifts, providers } from "@db/schema";
import type { ShiftStatus } from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";
import ical from 'node-ical';
import fetch from 'node-fetch';

// Initialize providers if they don't exist
async function initializeProviders() {
  const existingProviders = await db.select().from(providers);
  if (existingProviders.length > 0) return;

  const defaultProviders = [
    {
      name: "Ashley Liou",
      title: "MD",
      targetDays: 105,
      tolerance: 7,
      maxConsecutiveWeeks: 1,
      color: "hsl(230, 75%, 60%)",
    },
    {
      name: "Joseph Brading",
      title: "MD",
      targetDays: 170,
      tolerance: 0,
      maxConsecutiveWeeks: 2,
      color: "hsl(160, 75%, 40%)",
    },
    {
      name: "Rajesh Harrykissoon",
      title: "MD",
      targetDays: 62,
      tolerance: 0,
      maxConsecutiveWeeks: 1,
      color: "hsl(350, 75%, 50%)",
    },
    {
      name: "Anthony Zachria",
      title: "DO",
      targetDays: 28,
      tolerance: 0,
      maxConsecutiveWeeks: 1,
      color: "hsl(45, 75%, 45%)",
    },
  ];

  for (const provider of defaultProviders) {
    await db.insert(providers).values(provider);
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Initialize providers when the server starts
  initializeProviders().catch(console.error);

  // Get all providers
  app.get("/api/providers", async (_req, res) => {
    try {
      const results = await db.select().from(providers);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to fetch providers",
        error: error.message
      });
    }
  });

  // Get shifts
  app.get("/api/shifts", async (_req, res) => {
    try {
      const results = await db.select().from(shifts);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to fetch shifts",
        error: error.message
      });
    }
  });

  // Create or update shift
  app.post("/api/shifts", async (req, res) => {
    try {
      const { providerId, startDate, endDate, source = 'manual' } = req.body;

      const result = await db.insert(shifts).values({
        providerId,
        startDate,
        endDate,
        source,
        status: 'confirmed' as ShiftStatus,
      }).returning();

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to create shift",
        error: error.message
      });
    }
  });

  // Update shift
  app.patch("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate, status } = req.body;

      const result = await db.update(shifts)
        .set({
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          ...(status && { status }),
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, parseInt(id)))
        .returning();

      if (!result.length) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to update shift",
        error: error.message
      });
    }
  });

  // Resolve QGenda conflicts endpoint
  app.post("/api/shifts/resolve-qgenda-conflicts", async (req, res) => {
    const { resolutions } = req.body;

    if (!Array.isArray(resolutions)) {
      return res.status(400).json({ message: "Invalid resolutions format" });
    }

    try {
      // Process each resolution in a single transaction
      const result = await db.transaction(async (tx) => {
        const processedShifts = [];

        for (const resolution of resolutions) {
          const { shiftId, action } = resolution;

          if (action === 'keep-qgenda') {
            // Mark the local shift as inactive
            const [updatedShift] = await tx.update(shifts)
              .set({
                status: 'inactive' as ShiftStatus,
                updatedAt: new Date(),
                schedulingNotes: {
                  reason: 'Resolved in favor of QGenda shift',
                  resolvedAt: new Date().toISOString()
                }
              })
              .where(eq(shifts.id, shiftId))
              .returning();

            processedShifts.push(updatedShift);
          } else if (action === 'keep-local') {
            // Keep the local shift and update its status to confirmed
            const [updatedShift] = await tx.update(shifts)
              .set({
                status: 'confirmed' as ShiftStatus,
                updatedAt: new Date(),
                schedulingNotes: {
                  reason: 'Kept local shift over QGenda',
                  resolvedAt: new Date().toISOString()
                }
              })
              .where(eq(shifts.id, shiftId))
              .returning();

            processedShifts.push(updatedShift);
          }
        }

        return processedShifts;
      });

      res.json({
        message: "Successfully resolved conflicts",
        shifts: result
      });
    } catch (error: any) {
      console.error('Error resolving conflicts:', error);
      res.status(500).json({
        message: "Failed to resolve conflicts",
        error: error.message
      });
    }
  });

  // QGenda sync endpoint with simplified conflict resolution
  app.post("/api/integrations/qgenda/import", async (req, res) => {
    try {
      const { subscriptionUrl, providerId } = req.body;

      if (!subscriptionUrl || !providerId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Step 1: Mark existing shifts as inactive
      await db.update(shifts)
        .set({
          status: 'inactive' as ShiftStatus,
          updatedAt: new Date(),
          schedulingNotes: {
            reason: 'Replaced by QGenda sync',
            updatedAt: new Date().toISOString()
          }
        })
        .where(
          and(
            eq(shifts.providerId, providerId),
            eq(shifts.status, 'confirmed')
          )
        );

      // Step 2: Fetch and parse QGenda calendar
      const response = await fetch(subscriptionUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch QGenda calendar");
      }

      const icalData = await response.text();
      const events = await ical.async.parseICS(icalData);

      // Step 3: Insert new shifts from QGenda
      const shiftsToInsert = [];
      for (const event of Object.values(events)) {
        if (event.type === 'VEVENT') {
          const startDate = event.start.toISOString().split('T')[0];
          const endDate = event.end.toISOString().split('T')[0];
          const eventId = event.uid || `qgenda-${startDate}-${endDate}`;

          shiftsToInsert.push({
            providerId,
            startDate,
            endDate,
            status: 'confirmed' as ShiftStatus,
            source: 'qgenda',
            externalId: eventId,
            schedulingNotes: {
              importedFrom: 'QGenda',
              eventSummary: event.summary || '',
              importedAt: new Date().toISOString()
            }
          });
        }
      }

      // Step 4: Insert new shifts
      const result = await db.insert(shifts)
        .values(shiftsToInsert)
        .returning();

      res.json({
        message: `Successfully imported ${result.length} shifts`,
        shifts: result
      });

    } catch (error: any) {
      console.error('QGenda import error:', error);
      res.status(500).json({
        message: "Failed to import QGenda schedule",
        error: error.message
      });
    }
  });

  return httpServer;
}