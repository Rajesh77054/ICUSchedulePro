import express from 'express';
import { Server } from 'http';
import ical from 'node-ical';
import { db } from '../db';
import { shifts } from '@db/schema';
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
        return res.status(400).json({ 
          message: "Missing required parameters" 
        });
      }

      // Fetch and parse QGenda calendar
      console.log('Fetching QGenda calendar from:', subscriptionUrl);
      const response = await fetch(encodeURI(subscriptionUrl), {
        headers: {
          'Accept': 'text/calendar,application/x-www-form-urlencoded',
          'User-Agent': 'ICU-Scheduler/1.0'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch QGenda calendar: ${response.status} ${response.statusText}`);
      }

      const icalData = await response.text();
      if (!icalData.includes('BEGIN:VCALENDAR')) {
        return res.status(400).json({ 
          message: "Invalid iCal data received. Please verify the QGenda URL is correct." 
        });
      }

      const events = await ical.async.parseICS(icalData);
      const shiftsToInsert = [];

      for (const [, event] of Object.entries(events)) {
        if (event.type === 'VEVENT' && event.start && event.end) {
          shiftsToInsert.push({
            providerId,
            startDate: event.start.toISOString().split('T')[0],
            endDate: event.end.toISOString().split('T')[0],
            status: 'confirmed' as const,
            source: 'qgenda',
            externalId: event.uid || `qgenda-${event.start}-${event.end}`,
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

      // Insert new shifts
      const result = await db.insert(shifts)
        .values(shiftsToInsert)
        .returning();

      broadcast({
        type: 'qgenda_sync_completed',
        data: {
          shiftsImported: result.length,
          conflicts: []
        },
        timestamp: new Date().toISOString(),
      });

      return res.json({
        message: `Successfully imported ${result.length} shifts`,
        shifts: result
      });

    } catch (error: any) {
      console.error('QGenda import error:', error);
      broadcast({
        type: 'qgenda_sync_failed',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        message: "Failed to import QGenda schedule",
        error: error.message
      });
    }
  });

  return server;
}