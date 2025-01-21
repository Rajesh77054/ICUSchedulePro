
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

      const response = await openaiHandler.processMessage(userMessage);
      res.json({ content: response });
    } catch (error) {
      console.error('Error handling chat request:', error);
      res.status(500).json({ 
        content: "An error occurred while processing your request.",
        error: error.message 
      });
    }
  });

  return app;
}
