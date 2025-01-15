import express from 'express';
import { Server } from 'http';
import ical from 'node-ical';
import { db } from '../db';
import { shifts, ShiftStatus } from '@db/schema';
import { and, eq } from 'drizzle-orm';
import { setupWebSocket } from './websocket';

export function registerRoutes(app: express.Application) {
  const server = new Server(app);
  const { broadcast } = setupWebSocket(server);

  // QGenda import endpoint
  app.post("/api/integrations/qgenda/import-ical", async (req, res) => {
    try {
      const { subscriptionUrl, providerId } = req.body;

      if (!subscriptionUrl || !providerId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Step 1: Fetch and parse QGenda calendar
      console.log('Fetching QGenda calendar from:', subscriptionUrl);
      const encodedUrl = encodeURI(subscriptionUrl);
      const response = await fetch(encodedUrl, {
        headers: {
          'Accept': 'text/calendar,application/x-www-form-urlencoded',
          'User-Agent': 'ICU-Scheduler/1.0'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        console.error('QGenda fetch error:', response.status, response.statusText);
        throw new Error(`Failed to fetch QGenda calendar: ${response.status} ${response.statusText}`);
      }

      const icalData = await response.text();
      if (!icalData.includes('BEGIN:VCALENDAR')) {
        console.error('Invalid iCal data received:', icalData.substring(0, 200));
        return res.status(400).json({ 
          message: "Invalid iCal data received. Please verify the QGenda URL is correct and accessible."
        });
      }

      const events = await ical.async.parseICS(icalData);
      const shiftsToInsert: any[] = [];

      for (const [, event] of Object.entries(events)) {
        if (event.type === 'VEVENT' && event.start && event.end) {
          const startDate = event.start.toISOString().split('T')[0];
          const endDate = event.end.toISOString().split('T')[0];
          const eventId = event.uid || `qgenda-${startDate}-${endDate}`;

          shiftsToInsert.push({
            providerId,
            startDate,
            endDate,
            status: 'confirmed' as const,
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

      if (shiftsToInsert.length === 0) {
        return res.status(400).json({ 
          message: "No valid shifts found in the QGenda calendar" 
        });
      }

      // Step 3: Insert new shifts in a transaction
      const result = await db.transaction(async (tx) => {
        // First mark existing shifts as inactive
        await tx.update(shifts)
          .set({
            status: 'inactive' as const,
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

        // Then insert the new shifts
        return await tx.insert(shifts)
          .values(shiftsToInsert)
          .returning();
      });

      return res.json({
        message: `Successfully imported ${result.length} shifts`,
        shifts: result,
        conflicts: [] // Empty conflicts array as we're handling conflicts by marking old shifts inactive
      });

    } catch (error: any) {
      console.error('QGenda import error:', error);
      res.status(500).json({
        message: "Failed to import QGenda schedule",
        error: error.message
      });
    }
  });

  return server;
}