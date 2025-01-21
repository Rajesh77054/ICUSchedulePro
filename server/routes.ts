
import express, { Express } from 'express';
import { db } from '../db';
import { and, eq } from "drizzle-orm";
import { shifts, users, swapRequests } from '../db/schema';
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
      
      const hoursDistribution = allShifts.map(shift => {
        const startDate = new Date(shift.startDate);
        const endDate = new Date(shift.endDate);
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        
        return {
          name: `User ${shift.userId}`,
          hours: hours,
          target: 40 // Example target hours
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

  return app;
}
