import express, { Express } from 'express';
import { db } from '../db';
import { and, eq } from "drizzle-orm";
import { shifts, users, swapRequests, userPreferences } from '../db/schema'; // Added import for userPreferences
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export function registerRoutes(app: Express) {
  app.get('/api/shifts', async (req, res) => {
    try {
      const allShifts = await db.select().from(shifts);
      res.json(allShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({ error: 'Failed to fetch shifts' });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const userMessage = req.body.message;
      const openaiHandler = req.app.get('openaiHandler');

      if (!openaiHandler) {
        throw new Error('OpenAI handler not initialized');
      }

      // Fetch current context data
      const shiftsList = await db.select().from(shifts);
      const usersList = await db.select().from(users);

      const response = await openaiHandler.handleChat(userMessage, {
        shifts: shiftsList,
        users: usersList,
        currentPage: req.body.currentPage || 'unknown'
      });
      res.json({ content: response });
    } catch (error) {
      console.error('Error handling chat request:', error);
      res.status(500).json({ 
        content: "An error occurred while processing your request.",
        error: error.message 
      });
    }
  });

  // Chat room endpoints
  app.get('/api/chat/rooms/:roomId', async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const room = await db.query.chatRooms.findFirst({
        where: (rooms, { eq }) => eq(rooms.id, roomId),
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Chat room not found' });
      }

      // Format the response
      const formattedRoom = {
        id: room.id,
        name: room.name,
        type: room.type,
        members: room.members.map(member => ({
          id: member.user.id,
          name: member.user.name,
          title: member.user.title
        }))
      };

      res.json(formattedRoom);
    } catch (error) {
      console.error('Error fetching chat room:', error);
      res.status(500).json({ error: 'Failed to fetch chat room' });
    }
  });

  app.get('/api/chat/rooms/:roomId/messages', async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const messages = await db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.roomId, roomId),
        with: {
          sender: true
        },
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      const formattedMessages = messages.map(message => ({
        id: message.id,
        content: message.content,
        sender: {
          name: message.sender.name,
          title: message.sender.title
        },
        messageType: message.type,
        metadata: message.metadata,
        createdAt: message.createdAt
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Analytics endpoints
  app.get('/api/analytics/workload', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      // Group shifts by user and calculate total hours
      const userHours = allShifts.reduce((acc, shift) => {
        const startDate = new Date(shift.startDate);
        const endDate = new Date(shift.endDate);
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        if (!acc[shift.userId]) {
          acc[shift.userId] = { hours: 0, target: 160 }; // 160 hours per month (40 hours/week)
        }
        acc[shift.userId].hours += hours;
        return acc;
      }, {});

      const allUsers = await db.select().from(users);
      const hoursDistribution = Object.entries(userHours).map(([userId, data]) => {
        const user = allUsers.find(u => u.id === parseInt(userId));
        const now = new Date();
        const userShifts = allShifts.filter(s => s.userId === parseInt(userId));

        const workedShifts = userShifts.filter(s => new Date(s.startDate) <= now);
        const upcomingShifts = userShifts.filter(s => new Date(s.startDate) > now);

        const workedHours = workedShifts.reduce((acc, shift) => {
          const hours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0);

        const upcomingHours = upcomingShifts.reduce((acc, shift) => {
          const hours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0);

        const workedDays = Math.ceil(workedHours / 8);
        const upcomingDays = Math.ceil(upcomingHours / 8);

        return {
          name: user?.name?.split(' ')[0] || `User ${userId}`,
          workedHours: Math.round(workedHours),
          upcomingHours: Math.round(upcomingHours),
          targetHours: data.target,
          workedDays,
          upcomingDays,
          targetDays: 20,
          workedShifts: workedShifts.length,
          upcomingShifts: upcomingShifts.length,
          targetShifts: 15
        };
      });

      res.json({ hoursDistribution });
    } catch (error) {
      console.error('Error fetching workload data:', error);
      res.status(500).json({ error: 'Failed to fetch workload data' });
    }
  });

  app.get('/api/analytics/fatigue', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      const fatigueMetrics = allShifts.map(shift => ({
        date: shift.startDate,
        consecutiveShifts: 1, // Example metric
        restHours: 24 // Example metric
      }));

      res.json({ fatigueMetrics });
    } catch (error) {
      console.error('Error fetching fatigue data:', error);
      res.status(500).json({ error: 'Failed to fetch fatigue data' });
    }
  });

  app.get('/api/analytics/distribution', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || 'month';
      const allShifts = await db.select().from(shifts);

      const fairnessMetrics = allShifts.reduce((acc, shift) => {
        const existingMetric = acc.find(m => m.name === `User ${shift.userId}`);
        if (existingMetric) {
          existingMetric.value += 1;
        } else {
          acc.push({ name: `User ${shift.userId}`, value: 1 });
        }
        return acc;
      }, []);

      res.json({ fairnessMetrics });
    } catch (error) {
      console.error('Error fetching distribution data:', error);
      res.status(500).json({ error: 'Failed to fetch distribution data' });
    }
  });

  app.get('/api/user-preferences/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userPreferences = await db.query.userPreferences.findFirst({
        where: (preferences, { eq }) => eq(preferences.userId, userId)
      });
      res.json(userPreferences || {});
    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.patch('/api/user-preferences/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const updates = req.body;

      // First check if preferences exist
      const existing = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

      let result;
      const values = {
        preferredShiftLength: parseInt(updates.preferredShiftLength) || 7,
        maxShiftsPerWeek: parseInt(updates.maxShiftsPerWeek) || 1,
        minDaysBetweenShifts: parseInt(updates.minDaysBetweenShifts) || 0,
        preferredDaysOfWeek: Array.isArray(updates.preferredDaysOfWeek) ? updates.preferredDaysOfWeek : [],
        avoidedDaysOfWeek: Array.isArray(updates.avoidedDaysOfWeek) ? updates.avoidedDaysOfWeek : [],
        updatedAt: new Date()
      };

      if (existing.length > 0) {
        // Update existing preferences
        result = await db
          .update(userPreferences)
          .set(values)
          .where(eq(userPreferences.userId, userId))
          .returning();
      } else {
        // Create new preferences
        result = await db
          .insert(userPreferences)
          .values({
            ...values,
            userId,
            createdAt: new Date()
          })
          .returning();
      }

      if (!result.length) {
        return res.status(404).json({ error: 'Failed to update preferences' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences: ' + error.message });
    }
  });

  return app;
}