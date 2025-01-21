import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
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
      const users = await db.select().from(schema.users);

      // Helper function to format dates consistently
      const formatDate = (date: string) => new Date(date).toLocaleDateString();

      // Process natural language queries
      const userMessage = lastMessage.content.toLowerCase();

      // Get user context
      const currentUser = users.find(u => u.id === pageContext?.userId);
      const userContext = {
        shifts: shifts.filter(s => s.userId === currentUser?.id),
        pendingSwaps: shifts.filter(s => s.status === 'pending_swap'),
        allUsers: users,
      };

      // Process the message content
      const messageContent = lastMessage.content.toLowerCase();

      // Handle colleague and team queries
      if (messageContent.includes('colleague') || messageContent.includes('team') || messageContent.includes('who are my')) {
        const usersList = users.map(user => `${user.name}, ${user.title} (${user.userType.toUpperCase()})`);
        return res.json({
          content: `Your colleagues are:\n${usersList.join('\n')}`
        });
      }

      // Handle shift count queries
      if (messageContent.includes('how many shifts')) {
        const nameMatch = userMessage.match(/how many shifts does (\w+) have/i);
        if (nameMatch) {
          const name = nameMatch[1].toLowerCase();
          const targetUser = users.find(u => u.name.toLowerCase().includes(name));
          if (!targetUser) {
            return res.json({ content: `I couldn't find a user named ${nameMatch[1]}.` });
          }
          const userShifts = shifts.filter(s => s.userId === targetUser.id);
          return res.json({
            content: `${targetUser.name} currently has ${userShifts.length} shifts scheduled.`
          });
        }
      }

      // Greet with context
      if (messages.length === 1) {
        const suggestions = [];
        const userShifts = currentUser ? shifts.filter(s => s.userId === currentUser.id) : [];

        if (userShifts.length > 0) {
          suggestions.push(
            `- You have ${userShifts.length} upcoming shifts`,
            "- View your schedule details",
            "- Check for schedule conflicts"
          );

          const pendingSwaps = userShifts.filter(s => s.status === 'pending_swap');
          if (pendingSwaps.length > 0) {
            suggestions.push(`- You have ${pendingSwaps.length} pending swap requests`);
          }
        }

        return res.json({
          content: `Hello${currentUser ? ` ${currentUser.name}` : ''}! I'm your schedule assistant. How can I help you today?\n\n${suggestions.length > 0 ? `Here's what I see:\n${suggestions.join('\n')}` : ''}`
        });
      }

      // Enhanced shift management
      if (userMessage.includes('delete shift') || userMessage.includes('remove shift')) {
        const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/;
        const namePattern = /(?:for|from)\s+(\w+):/i;

        const dateMatch = userMessage.match(datePattern);
        const nameMatch = userMessage.match(namePattern);

        if (dateMatch && nameMatch) {
          const [_, startDate, endDate] = dateMatch;
          const name = nameMatch[1];
          const targetUser = users.find(u => u.name.toLowerCase().includes(name.toLowerCase()));

          if (!targetUser) {
            return res.json({ content: `I couldn't find a user named ${name}.` });
          }

          const matchingShifts = shifts.filter(s => 
            s.userId === targetUser.id &&
            s.startDate === new Date(startDate).toISOString().split('T')[0] &&
            s.endDate === new Date(endDate).toISOString().split('T')[0]
          );

          if (matchingShifts.length > 0) {
            try {
              await db.delete(schema.shifts).where(eq(schema.shifts.id, matchingShifts[0].id));
              const remainingShifts = shifts.filter(s => s.userId === targetUser.id).length - 1;
              return res.json({
                content: `I've deleted the shift for ${targetUser.name} from ${startDate} to ${endDate}. They now have ${remainingShifts} shifts scheduled.`
              });
            } catch (error) {
              return res.json({
                content: `I encountered an error while trying to delete the shift: ${error.message}`
              });
            }
          } else {
            return res.json({
              content: `I couldn't find a shift for ${targetUser.name} from ${startDate} to ${endDate}. Would you like to see their current schedule?`
            });
          }
        }
      }

      // Handle shift count and holiday queries
      const messageContent = lastMessage.content.toLowerCase();

      if (messageContent.includes('holiday')) {
        const nameMatch = messageContent.match(/does (\w+) work/i);
        if (nameMatch) {
          const name = nameMatch[1].toLowerCase();
          const userShifts = shifts.filter(s => 
            s.user?.name.toLowerCase().includes(name)
          );

          const holidays = {
            '01-01': 'New Year\'s Day',
            '01-15': 'Martin Luther King Jr. Day',
            '02-19': 'Presidents\' Day'
          };

          const holidayShifts = userShifts.filter(shift => {
            const shiftDate = new Date(shift.startDate);
            const monthDay = `${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`;
            return holidays[monthDay];
          });

          if (holidayShifts.length > 0) {
            const holidayList = holidayShifts.map(shift => {
              const date = new Date(shift.startDate);
              const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              return holidays[monthDay];
            }).join(', ');
            return res.json({
              content: `Yes, ${nameMatch[1]} works on the following holidays: ${holidayList}`
            });
          } else {
            return res.json({
              content: `No, ${nameMatch[1]} does not work on any holidays this month.`
            });
          }
        }
      }

      if (messageContent.includes('how many shifts')) {
        const nameMatch = messageContent.match(/how many shifts does (\w+) have/i);
        if (nameMatch) {
          const name = nameMatch[1].toLowerCase();
          const userShifts = shifts.filter(s => 
            s.user?.name.toLowerCase().includes(name)
          );
          return res.json({
            content: `${nameMatch[1]} currently has ${userShifts.length} shifts scheduled.`
          });
        }
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
        try {
          let result = 0;
          switch (operator) {
            case '+': result = parseFloat(num1) + parseFloat(num2); break;
            case '-': result = parseFloat(num1) - parseFloat(num2); break;
            case '*': result = parseFloat(num1) * parseFloat(num2); break;
            case '/': 
              if (parseFloat(num2) === 0) {
                return res.json({ content: "Cannot divide by zero!" });
              }
              result = parseFloat(num1) / parseFloat(num2); 
              break;
          }
          return res.json({
            content: `The result is ${result.toFixed(2)}`
          });
        } catch (error) {
          return res.json({
            content: "I had trouble calculating that. Please check the numbers and try again."
          });
        }
      }

      if (lastMessage.content.toLowerCase().includes('create new shift')) {
        const match = lastMessage.content.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (match) {
          const startDate = new Date(match[1]);
          const endDate = new Date(match[2]);

          try {
            // Delete any existing shifts with the same date range
            await db.delete(schema.shifts)
              .where(sql`${schema.shifts.startDate} = ${startDate.toISOString().split('T')[0]} 
                AND ${schema.shifts.endDate} = ${endDate.toISOString().split('T')[0]}`);

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