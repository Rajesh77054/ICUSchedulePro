
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
      const lastMessage = messages[messages.length - 1];
      const shifts = pageContext?.shifts || [];
      
      // If this is the initial greeting, provide contextual suggestions
      if (messages.length === 1) {
        const suggestions = [];
        if (shifts.length > 0) {
          suggestions.push(
            "- Ask about your current shifts",
            "- Check for schedule conflicts",
            "- View pending swap requests"
          );
        }
        if (pageContext?.currentPage === 'dashboard') {
          suggestions.push(
            "- Create a new shift",
            "- Request time off",
            "- View upcoming schedule"
          );
        }
        
        if (suggestions.length > 0) {
          return res.json({
            content: `Hello! I'm your schedule assistant. How can I help you manage your schedule today?\n\nYou can try:\n${suggestions.join('\n')}`
          });
        }
      }

      // Handle shift count query
      const userMessage = lastMessage.content.toLowerCase();
      
      // Handle shift count queries
      if (userMessage.includes('how many shifts')) {
        return res.json({
          content: `Ashley currently has ${shifts.length} shifts scheduled.`
        });
      }

      // Handle date range queries
      if (userMessage.includes('when') || userMessage.includes('what dates')) {
        const nextShift = shifts.find(s => new Date(s.startDate) > new Date());
        if (nextShift) {
          return res.json({
            content: `The next shift is scheduled from ${nextShift.startDate} to ${nextShift.endDate}`
          });
        }
      }

      // Handle swap status queries
      if (userMessage.includes('swap') || userMessage.includes('trade')) {
        const pendingSwaps = shifts.filter(s => s.status === 'pending_swap');
        if (pendingSwaps.length > 0) {
          return res.json({
            content: `There are ${pendingSwaps.length} pending shift swap requests.`
          });
        }
      }

      // Handle schedule conflict queries
      if (userMessage.includes('conflict') || userMessage.includes('overlap')) {
        const overlappingShifts = shifts.filter(s1 => 
          shifts.some(s2 => 
            s1.id !== s2.id && 
            new Date(s1.startDate) <= new Date(s2.endDate) && 
            new Date(s1.endDate) >= new Date(s2.startDate)
          )
        );
        if (overlappingShifts.length > 0) {
          return res.json({
            content: `I found ${overlappingShifts.length} overlapping shifts in the schedule.`
          });
        }
      }

      // Handle math calculations
      const mathRegex = /(?:what\s+is\s+)?(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/i;
      const mathMatch = lastMessage.content.match(mathRegex);
      if (mathMatch) {
        const [_, num1, operator, num2] = mathMatch;
        let result = 0;
        switch (operator) {
          case '+': result = parseFloat(num1) + parseFloat(num2); break;
          case '-': result = parseFloat(num1) - parseFloat(num2); break;
          case '*': result = parseFloat(num1) * parseFloat(num2); break;
          case '/': result = parseFloat(num1) / parseFloat(num2); break;
        }
        return res.json({
          content: `The result is ${result.toFixed(2)}`
        });
      }
      
      if (lastMessage.content.toLowerCase().includes('create new shift')) {
        const match = lastMessage.content.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (match) {
          const startDate = new Date(match[1]);
          const endDate = new Date(match[2]);
          
          try {
            const newShift = await db.insert(schema.shifts).values({
              userId: 1, // For Ashley
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              status: 'confirmed',
              source: 'manual'
            }).returning();

            // Fetch updated shifts
            const shifts = await db.select().from(schema.shifts);
            
            return res.json({
              content: `Created a new shift from ${match[1]} to ${match[2]}.`,
              shifts: shifts // Include updated shifts in response
            });
          } catch (err) {
            return res.json({
              content: 'Sorry, I was unable to create the shift. Please try again.'
            });
          }
        }
      }
      
      const response = {
        content: `I can help you create a new shift. Please provide the dates in format: MM/DD/YYYY - MM/DD/YYYY`
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