import { db } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';
// routes.ts
import express, { Express } from 'express';
import { OpenAIChatHandler } from './openai-handler';

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

  const chatHandler = new OpenAIChatHandler();

  app.post('/api/chat', async (req, res) => {
    try {
      console.log('Chat request received:', req.body);
      const { messages, pageContext } = req.body;
      const users = await db.select().from(schema.users);
      const shifts = pageContext?.shifts || [];

      const chatContext = {
        shifts,
        users,
        currentPage: pageContext?.currentPage || 'unknown'
      };

      const lastMessage = messages[messages.length - 1];
      const chatResponse = await chatHandler.handleChat(lastMessage.content, chatContext);

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
        // Filter based on physician/APP if specified
        let filteredUsers = users;
        if (messageContent.includes('physician')) {
          filteredUsers = users.filter(user => user.userType === 'physician');
        } else if (messageContent.includes('app')) {
          filteredUsers = users.filter(user => user.userType === 'app');
        }

        const usersList = filteredUsers.map(user => `${user.name}, ${user.title} (${user.userType.toUpperCase()})`);

        const typeLabel = messageContent.includes('physician') ? 'physician ' : 
                         messageContent.includes('app') ? 'APP ' : '';
        return res.json({
          content: `Your ${typeLabel}colleagues are:\n${usersList.join('\n')}`
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

      // Handle swap acceptance
      if (userMessage.toLowerCase().includes('accept') && userMessage.toLowerCase().includes('swap')) {
        const swapRequests = await db.select().from(schema.swapRequests)
          .where(eq(schema.swapRequests.status, 'pending'));

        if (swapRequests.length > 0) {
          const request = swapRequests[0];
          await db.update(schema.swapRequests)
            .set({ status: 'accepted', updatedAt: new Date() })
            .where(eq(schema.swapRequests.id, request.id));

          await db.update(schema.shifts)
            .set({ 
              status: 'swapped',
              userId: request.recipientId 
            })
            .where(eq(schema.shifts.id, request.shiftId));

          const requestor = users.find(u => u.id === request.requestorId);
          const recipient = users.find(u => u.id === request.recipientId);

          return res.json({
            content: `Shift swap request between ${requestor?.name} and ${recipient?.name} has been accepted.`
          });
        }
      }

      // Handle swap status queries and requests
      if (userMessage.toLowerCase().includes('swap') || userMessage.toLowerCase().includes('trade')) {
        const dateMatch = userMessage.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        const recipientMatch = userMessage.match(/with\s+(\w+)/i);

        // Handle creating new swap request
        if ((dateMatch || userMessage.toLowerCase().includes('this shift')) && recipientMatch) {
          const recipientName = recipientMatch[1];
          const recipient = users.find(u => u.name.toLowerCase().includes(recipientName.toLowerCase()));

          // Find the relevant shift
          let targetShift;
          if (dateMatch) {
            const shiftDate = new Date(dateMatch[1]);
            targetShift = shifts.find(s => 
              new Date(s.startDate).toDateString() === shiftDate.toDateString()
            );
          } else {
            // Use the most recently discussed shift
            const shiftId = chatContext.currentShiftId;
            targetShift = shifts.find(s => s.id === shiftId);
          }

          if (!targetShift) {
            return res.json({
              content: "I couldn't find the shift you're referring to."
            });
          }

          if (!recipient) {
            return res.json({
              content: `I couldn't find a user named ${recipientName}.`
            });
          }

          try {
            await db.transaction(async (tx) => {
              console.log('Creating swap request:', { shiftId: targetShift.id, requestorId: targetShift.userId, recipientId: recipient.id });
              // Create swap request
              const swapRequest = await tx.insert(schema.swapRequests).values({
                shiftId: targetShift.id,
                requestorId: targetShift.userId,
                recipientId: recipient.id,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
              }).returning();

              // Update shift status
              await tx.update(schema.shifts)
                .set({ status: 'pending_swap' })
                .where(eq(schema.shifts.id, targetShift.id));
            });

            return res.json({
              content: `Created swap request for the shift (${new Date(targetShift.startDate).toLocaleDateString()} to ${new Date(targetShift.endDate).toLocaleDateString()}) with ${recipient.name}.`
            });
          } catch (error) {
            console.error('Error creating swap request:', error);
            return res.json({
              content: "I encountered an error while creating the swap request. Please try again."
            });
          }

          // Continue with name matching logic
            const nameMatch = userMessage.match(/does (\w+) have/i);
        const swapRequests = await db.select().from(schema.swapRequests).where(eq(schema.swapRequests.status, 'pending'));

        if (swapRequests.length > 0) {
          if (nameMatch) {
            const name = nameMatch[1].toLowerCase();
            const relevantSwaps = swapRequests.filter(swap => {
              const requestor = users.find(u => u.id === swap.requestorId);
              const recipient = users.find(u => u.id === swap.recipientId);
              return requestor?.name.toLowerCase().includes(name) || recipient?.name.toLowerCase().includes(name);
            });
            return res.json({
              content: relevantSwaps.length > 0 ? 
                `Yes, ${nameMatch[1]} is involved in ${relevantSwaps.length} pending swap request(s).` :
                `No, ${nameMatch[1]} does not have any pending swap requests.`
            });
          }

          if (userMessage.includes('who') || userMessage.includes('requestor') || userMessage.includes('requestee') || userMessage.includes('other staff')) {
            const pendingSwaps = await db.select().from(schema.swapRequests)
              .where(eq(schema.swapRequests.status, 'pending'));

            if (pendingSwaps.length === 0) {
              return res.json({
                content: "There are no pending swap requests at the moment."
              });
            }

            const swap = pendingSwaps[0];
            const requestor = users.find(u => u.id === swap.requestorId);
            const recipient = users.find(u => u.id === swap.recipientId);
            const shift = shifts.find(s => s.id === swap.shiftId);

            if (!requestor || !recipient || !shift) {
              return res.json({
                content: "Could not find complete information about the swap request."
              });
            }

            return res.json({
              content: `${requestor.name} has requested to swap their shift (${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}) with ${recipient.name}. The request is currently ${swap.status}.`
            });
          } else if (userMessage.includes('date')) {
            const swap = swapRequests[0];
            const shift = shifts.find(s => s.id === swap.shiftId);
            const requestor = users.find(u => u.id === swap.requestorId);
            const recipient = users.find(u => u.id === swap.recipientId);

            if (!shift || !requestor || !recipient) {
              return res.json({
                content: "Could not find complete details for this swap request."
              });
            }

            return res.json({
              content: `${requestor.name} has requested to swap their shift (${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}) with ${recipient.name}. The request is currently ${swap.status}. Would you like to approve, reject, or cancel this swap request?`
            });
          } else {
            const swap = swapRequests[0];
            const requestor = users.find(u => u.id === swap.requestorId);
            const recipient = users.find(u => u.id === swap.recipientId);
            const shift = shifts.find(s => s.id === swap.shiftId);

            if (!requestor || !recipient || !shift) {
              return res.json({
                content: "Could not find complete details for this swap request."
              });
            }

            return res.json({
              content: `${requestor.name} has requested to swap their shift (${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}) with ${recipient.name}. The request is currently ${swap.status}.`
            });
          }
        }
      } else if (userMessage.toLowerCase().includes('request') && userMessage.toLowerCase().includes('swap')) {
        const nameMatch = userMessage.match(/with\s+(\w+)/i);
        if (nameMatch) {
          const recipientName = nameMatch[1];
          const recipient = users.find(u => u.name.toLowerCase().includes(recipientName.toLowerCase()));
          const currentShift = shifts.find(s => s.status !== 'swapped' && new Date(s.startDate) > new Date());

          if (!currentShift) {
            return res.json({
              content: "I couldn't find an eligible shift to swap."
            });
          }

          if (!recipient) {
            return res.json({
              content: `I couldn't find a user named ${recipientName}.`
            });
          }

          // Separate transaction logic
          const createSwapRequest = async () => {
            return await db.transaction(async (tx) => {
              try {
                console.log('Creating swap request:', { 
                  shiftId: currentShift.id, 
                  requestorId: currentShift.userId, 
                  recipientId: recipient.id 
                });

                const swapRequest = await tx.insert(schema.swapRequests).values({
                  shiftId: currentShift.id,
                  requestorId: currentShift.userId,
                  recipientId: recipient.id,
                  status: 'pending',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }).returning();

                await tx.update(schema.shifts)
                  .set({ status: 'pending_swap' })
                  .where(eq(schema.shifts.id, currentShift.id));

                return { success: true, swapRequest };
              } catch (error) {
                console.error('Transaction error:', error);
                return { success: false, error };
              }
            });
          };

          const result = await createSwapRequest();
          
          if (result.success) {
            return res.json({
              content: `Created swap request for your shift (${new Date(currentShift.startDate).toLocaleDateString()} to ${new Date(currentShift.endDate).toLocaleDateString()}) with ${recipient.name}.`
            });
          } else {
            return res.json({
              content: "I encountered an error while creating the swap request. Please try again."
            });
          }
        }
      }

      return res.json({
        content: "There are no pending shift swap requests."
      });
    } catch (error) {
      console.error('Error handling request:', error);
      return res.json({
        content: "An error occurred while processing your request."
      });
    }
      console.error('Error handling request:', error);
      return res.json({
        content: "An error occurred while processing your request."
      });
    }
  });

  return app;
}

//other files...