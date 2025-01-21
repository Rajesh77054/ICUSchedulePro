
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

  return app;
}
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
