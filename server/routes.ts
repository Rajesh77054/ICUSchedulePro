
import { db } from '../db';
import * as schema from '../db/schema';

// routes.ts
import express, { Express } from 'express';

export function registerRoutes(app: Express) {
  app.get('/api/shifts', async (req, res) => {
    try {
      const shifts = await db.select().from(schema.shifts);
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch shifts' });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const users = await db.select().from(schema.users);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      console.log('Chat request received:', req.body);
      const { messages, pageContext } = req.body;
      const shifts = pageContext?.shifts || [];
      const response = {
        content: `I see you have ${shifts.length} shifts in your schedule. How can I help you manage them?`
      };
      console.log('Chat response:', response);
      res.json(response);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  });

  return app;
}

//other files...