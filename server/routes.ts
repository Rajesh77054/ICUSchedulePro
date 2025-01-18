import express, { Express } from 'express';
import { createServer, Server } from 'http';
import { db } from '../db';
import { users, shifts, userPreferences, timeOffRequests, swapRequests, chatRooms, messages, roomMembers } from '@db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';
import { setupAuth } from './auth';
import ical from 'ical-generator';

export function registerRoutes(app: Express): Server {
  // Initialize auth system
  setupAuth(app);

  const server = createServer(app);
  const { broadcast, broadcastToRoom } = setupWebSocket(server);

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const result = await db.query.users.findMany();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user preferences
  app.get("/api/user-preferences/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // First check if the user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Try to find existing preferences
      const preferences = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, parseInt(userId)),
      });

      if (!preferences) {
        // Create default preferences if none exist
        const [newPreferences] = await db.insert(userPreferences)
          .values({
            userId: parseInt(userId),
            preferredShiftLength: 7,
            maxShiftsPerWeek: 1,
            minDaysBetweenShifts: 0,
            preferredDaysOfWeek: [],
            avoidedDaysOfWeek: [],
          })
          .returning();

        return res.json({
          ...newPreferences,
          defaultView: 'dayGridMonth',
          defaultCalendarDuration: 'month',
          notificationPreferences: {
            emailNotifications: true,
            inAppNotifications: true,
            notifyOnNewShifts: true,
            notifyOnSwapRequests: true,
            notifyOnTimeOffUpdates: true,
            notifyBeforeShift: 24,
          }
        });
      }

      // Return existing preferences with additional UI preferences
      res.json({
        ...preferences,
        defaultView: 'dayGridMonth',
        defaultCalendarDuration: 'month',
        notificationPreferences: {
          emailNotifications: true,
          inAppNotifications: true,
          notifyOnNewShifts: true,
          notifyOnSwapRequests: true,
          notifyOnTimeOffUpdates: true,
          notifyBeforeShift: 24,
        }
      });
    } catch (error: any) {
      console.error('Error fetching user preferences:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user preferences
  app.patch("/api/user-preferences/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // First check if the user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Try to update existing preferences
      const [updated] = await db.update(userPreferences)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, parseInt(userId)))
        .returning();

      if (!updated) {
        // If no preferences exist, create them
        const [newPreferences] = await db.insert(userPreferences)
          .values({
            userId: parseInt(userId),
            ...updates,
          })
          .returning();

        return res.json(newPreferences);
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new user
  app.post("/api/users", async (req, res) => {
    try {
      const { name, title, userType, targetDays, tolerance, maxConsecutiveWeeks, color } = req.body;

      const [user] = await db.insert(users)
        .values({
          name,
          title,
          userType,
          targetDays,
          tolerance,
          maxConsecutiveWeeks,
          color
        })
        .returning();

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, title, userType, targetDays, tolerance, maxConsecutiveWeeks, color } = req.body;

      const [user] = await db.update(users)
        .set({
          name,
          title,
          userType,
          targetDays,
          tolerance,
          maxConsecutiveWeeks,
          color
        })
        .where(eq(users.id, parseInt(id)))
        .returning();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const [user] = await db.delete(users)
        .where(eq(users.id, parseInt(id)))
        .returning();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all shifts
  app.get("/api/shifts", async (_req, res) => {
    try {
      const result = await db.query.shifts.findMany({
        with: {
          user: true
        }
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all shifts
  app.delete("/api/shifts", async (_req, res) => {
    try {
      // Get all shifts with their users for notification
      const allShifts = await db.query.shifts.findMany({
        with: {
          user: true
        }
      });

      // Delete all shifts
      await db.delete(shifts);

      // Notify about each deletion
      for (const shift of allShifts) {
        if (shift.user) {
          broadcast(notify.shiftDeleted(shift, {
            name: shift.user.name,
            title: shift.user.title
          }));
        }
      }

      res.json({ message: `Successfully cleared ${allShifts.length} shifts` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shift
  app.post("/api/shifts", async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.body;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [shift] = await db.insert(shifts)
        .values({
          userId,
          startDate,
          endDate,
          status: 'confirmed',
          source: 'manual'
        })
        .returning();

      broadcast(notify.shiftCreated(shift, {
        name: user.name,
        title: user.title
      }));

      res.json(shift);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update shift
  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.body;

      // Get the shift and user for notification
      const oldShift = await db.query.shifts.findFirst({
        where: eq(shifts.id, parseInt(id)),
        with: {
          user: true
        }
      });

      if (!oldShift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const [updated] = await db.update(shifts)
        .set({
          startDate,
          endDate,
          updatedAt: new Date()
        })
        .where(eq(shifts.id, parseInt(id)))
        .returning();

      if (oldShift.user) {
        broadcast(notify.shiftUpdated(updated, {
          name: oldShift.user.name,
          title: oldShift.user.title
        }));
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Request shift swap endpoint
  app.post("/api/swap-requests", async (req, res) => {
    try {
      const { shiftId, requestorId, recipientId } = req.body;

      // Get the shift and users involved
      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
        with: {
          user: true
        }
      });

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const requestor = await db.query.users.findFirst({
        where: eq(users.id, requestorId)
      });

      const recipient = await db.query.users.findFirst({
        where: eq(users.id, recipientId)
      });

      if (!requestor || !recipient) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate user types match
      if (requestor.userType !== recipient.userType) {
        return res.status(400).json({
          message: `Cannot swap shifts between different provider types (${requestor.userType} and ${recipient.userType})`
        });
      }

      // Start a transaction
      const [swapRequest, updatedShift] = await db.transaction(async (tx) => {
        // First update the shift status
        const [updatedShift] = await tx.update(shifts)
          .set({
            status: 'pending_swap',
            updatedAt: new Date()
          })
          .where(eq(shifts.id, shiftId))
          .returning();

        if (!updatedShift) {
          throw new Error("Failed to update shift status");
        }

        // Then create the swap request
        const [newRequest] = await tx.insert(swapRequests)
          .values({
            shiftId,
            requestorId,
            recipientId,
            status: 'pending',
            createdAt: new Date()
          })
          .returning();

        if (!newRequest) {
          throw new Error("Failed to create swap request");
        }

        return [newRequest, updatedShift];
      });

      // Send notification about the swap request
      broadcast(notify.shiftSwapRequested(
        updatedShift,
        {
          name: requestor.name,
          title: requestor.title,
          userType: requestor.userType
        },
        {
          name: recipient.name,
          title: recipient.title,
          userType: recipient.userType
        },
        swapRequest.id
      ));

      res.json({ swapRequest, shift: updatedShift });
    } catch (error: any) {
      console.error('Error creating swap request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add swap request response endpoint after the swap request creation endpoint
  app.post("/api/swap-requests/:id/respond", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, responderId } = req.body;

      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'accepted' or 'rejected'" });
      }

      // Start a transaction to handle both swap request and shift updates
      const [updatedRequest, updatedShift] = await db.transaction(async (tx) => {
        // Get the swap request with related shift and users
        const request = await tx.query.swapRequests.findFirst({
          where: eq(swapRequests.id, parseInt(id)),
          with: {
            shift: true
          }
        });

        if (!request) {
          throw new Error("Swap request not found");
        }

        // Get users involved
        const requestor = await tx.query.users.findFirst({
          where: eq(users.id, request.requestorId)
        });

        const recipient = await tx.query.users.findFirst({
          where: eq(users.id, request.recipientId)
        });

        if (!requestor || !recipient) {
          throw new Error("Users not found");
        }

        // Update swap request status
        const [updatedRequest] = await tx.update(swapRequests)
          .set({
            status,
            updatedAt: new Date()
          })
          .where(eq(swapRequests.id, parseInt(id)))
          .returning();

        if (!updatedRequest) {
          throw new Error("Failed to update swap request");
        }

        // Update shift based on response
        const [updatedShift] = await tx.update(shifts)
          .set({
            status: status === 'accepted' ? 'swapped' : 'confirmed',
            userId: status === 'accepted' ? request.recipientId : request.requestorId,
            updatedAt: new Date()
          })
          .where(eq(shifts.id, request.shiftId))
          .returning();

        if (!updatedShift) {
          throw new Error("Failed to update shift");
        }

        // Send notification about the swap response
        broadcast(notify.shiftSwapResponded(
          updatedShift,
          {
            name: requestor.name,
            title: requestor.title,
            userType: requestor.userType
          },
          {
            name: recipient.name,
            title: recipient.title,
            userType: recipient.userType
          },
          status
        ));

        return [updatedRequest, updatedShift];
      });

      res.json({ request: updatedRequest, shift: updatedShift });
    } catch (error: any) {
      console.error('Error responding to swap request:', error);
      res.status(500).json({ message: error.message });
    }
  });


  // Delete shift
  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Get the shift and user for notification
      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, parseInt(id)),
        with: {
          user: true
        }
      });

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const [deleted] = await db.delete(shifts)
        .where(eq(shifts.id, parseInt(id)))
        .returning();

      if (shift.user) {
        broadcast(notify.shiftDeleted(deleted, {
          name: shift.user.name,
          title: shift.user.title
        }));
      }

      res.json({ message: "Shift deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all time off requests with optional user filter
  app.get("/api/time-off-requests", async (req, res) => {
    try {
      const { userId } = req.query;

      const query = db.query.timeOffRequests.findMany({
        where: userId ? eq(timeOffRequests.userId, parseInt(userId as string)) : undefined,
        with: {
          user: true
        },
        orderBy: (timeOffRequests, { desc }) => [desc(timeOffRequests.createdAt)]
      });

      const results = await query;
      res.json(results);
    } catch (error: any) {
      console.error('Error fetching time-off requests:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/time-off-requests", async (req, res) => {
    try {
      const { userId, startDate, endDate } = req.body;

      // Validate user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [request] = await db.insert(timeOffRequests)
        .values({
          userId,
          startDate,
          endDate,
          status: 'pending',
          reason: null
        })
        .returning();

      // Send notification
      broadcast(notify.timeOffRequested(request, {
        name: user.name,
        title: user.title
      }));

      res.json(request);
    } catch (error: any) {
      console.error('Error creating time-off request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/time-off-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      // Validate request exists and get user information
      const existingRequest = await db.query.timeOffRequests.findFirst({
        where: eq(timeOffRequests.id, parseInt(id)),
        with: {
          user: true
        }
      });

      if (!existingRequest) {
        return res.status(404).json({ message: "Time off request not found" });
      }

      // Validate status
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      // Update the request
      const [updated] = await db.update(timeOffRequests)
        .set({
          status: status as 'approved' | 'rejected' | 'pending',
          reason: reason || null
        })
        .where(eq(timeOffRequests.id, parseInt(id)))
        .returning();

      // Send notification about the update
      if (existingRequest.user) {
        broadcast(notify.timeOffResponded(updated, {
          name: existingRequest.user.name,
          title: existingRequest.user.title
        }, status as 'approved' | 'rejected'));
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating time-off request:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete time off request
  app.delete("/api/time-off-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Validate request exists
      const existingRequest = await db.query.timeOffRequests.findFirst({
        where: eq(timeOffRequests.id, parseInt(id)),
        with: {
          user: true
        }
      });

      if (!existingRequest) {
        return res.status(404).json({ message: "Time off request not found" });
      }

      const [deleted] = await db.delete(timeOffRequests)
        .where(eq(timeOffRequests.id, parseInt(id)))
        .returning();

      if (existingRequest.user) {
        broadcast(notify.timeOffCancelled(deleted, {
          name: existingRequest.user.name,
          title: existingRequest.user.title
        }));
      }

      res.json({ message: "Time off request cancelled successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get workload analytics
  app.get("/api/analytics/workload", async (req, res) => {
    try {
      const { timeRange = 'month' } = req.query;

      // Calculate start date based on time range
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (timeRange === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 3);
      }

      // Get all shifts within the time range with their users
      const allShifts = await db.query.shifts.findMany({
        where: sql`${shifts.startDate} >= ${startDate.toISOString()}`,
        with: {
          user: true
        }
      });

      // Calculate hours worked per provider
      const hoursDistribution = allShifts.reduce((acc: any[], shift) => {
        const provider = shift.user;
        if (!provider) return acc;

        const existingProvider = acc.find(p => p.name === provider.name);
        const shiftHours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);

        if (existingProvider) {
          existingProvider.hours += shiftHours;
        } else {
          acc.push({
            name: provider.name,
            hours: shiftHours,
            target: provider.targetDays * 24 // Convert target days to hours
          });
        }

        return acc;
      }, []);

      res.json({ hoursDistribution });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get fatigue metrics
  app.get("/api/analytics/fatigue", async (req, res) => {
    try {
      const { timeRange = 'month' } = req.query;

      // Calculate start date based on time range
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (timeRange === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 3);
      }

      // Get all shifts within the time range
      const allShifts = await db.query.shifts.findMany({
        where: sql`${shifts.startDate} >= ${startDate.toISOString()}`,
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)],
        with: {
          user: true
        }
      });

      // Calculate consecutive shifts and rest periods
      const fatigueMetrics = allShifts.reduce((acc: any[], shift, index) => {
        if (index === 0) return acc;

        const prevShift = allShifts[index - 1];
        if (shift.userId === prevShift.userId) {
          const restHours = (new Date(shift.startDate).getTime() - new Date(prevShift.endDate).getTime()) / (1000 * 60 * 60);
          const date = new Date(shift.startDate).toLocaleDateString();

          acc.push({
            date,
            consecutiveShifts: acc.length > 0 ? acc[acc.length - 1].consecutiveShifts + 1 : 1,
            restHours
          });
        } else {
          acc.push({
            date: new Date(shift.startDate).toLocaleDateString(),
            consecutiveShifts: 0,
            restHours: 24 // Default rest period
          });
        }

        return acc;
      }, []);

      res.json({ fatigueMetrics });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get fair distribution metrics
  app.get("/api/analytics/distribution", async (req, res) => {
    try {
      const { timeRange = 'month' } = req.query;

      // Calculate start date based on time range
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (timeRange === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 3);
      }

      // Get all shifts within the time range
      const allShifts = await db.query.shifts.findMany({
        where: sql`${shifts.startDate} >= ${startDate.toISOString()}`,
        with: {
          user: true
        }
      });

      // Calculate workload distribution
      const distribution = allShifts.reduce((acc: Record<string, number>, shift) => {
        const provider = shift.user;
        if (!provider) return acc;

        const shiftHours = (new Date(shift.endDate).getTime() - new Date(shift.startDate).getTime()) / (1000 * 60 * 60);
        acc[provider.name] = (acc[provider.name] || 0) + shiftHours;
        return acc;
      }, {});

      // Convert to array format for pie chart
      const fairnessMetrics = Object.entries(distribution).map(([name, hours]) => ({
        name,
        value: hours
      }));

      res.json({ fairnessMetrics });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Chat Routes
  app.get("/api/chat/rooms", async (req, res) => {
    try {
      const result = await db.query.chatRooms.findMany({
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/rooms", async (req, res) => {
    try {
      const { name, type, memberIds } = req.body;
      const createdBy = req.user?.id; // Assuming authentication is set up

      if (!createdBy) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [room] = await db.insert(chatRooms)
        .values({
          name,
          type,
          createdBy
        })
        .returning();

      // Add members to the room
      await db.insert(roomMembers)
        .values(
          memberIds.map((userId: number) => ({
            roomId: room.id,
            userId,
            role: userId === createdBy ? 'admin' : 'member'
          }))
        );

      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, parseInt(id)),
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query.messages.findMany({
        where: eq(messages.roomId, parseInt(id)),
        with: {
          sender: true
        },
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, messageType = 'text', metadata = {} } = req.body;
      const senderId = req.user?.id; // Get user ID from authenticated session

      if (!senderId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [message] = await db.insert(messages)
        .values({
          roomId: parseInt(id),
          senderId,
          content,
          messageType,
          metadata
        })
        .returning();

      // Get the sender information
      const sender = await db.query.users.findFirst({
        where: eq(users.id, senderId)
      });

      if (sender) {
        // Broadcast the message to all room members
        broadcastToRoom(parseInt(id), notify.chatMessage(message, { id: parseInt(id) }, {
          name: sender.name,
          title: sender.title
        }));
      }

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calendar Export Routes
  app.get("/api/schedules/:userId/google", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate Google Calendar URL
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Google Calendar requires specific parameters
      const googleUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(
        `${req.protocol}://${req.get('host')}/api/schedules/${userId}/feed`
      )}`;

      res.redirect(googleUrl);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/outlook", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate iCal data
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Set headers for Outlook webcal subscription
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${user.name}-schedule.ics"`);
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/ical", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate iCal data
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Set headers for iCal download
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${user.name}-schedule.ics"`);
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/feed", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate calendar feed
      const calendar = ical({
        name: `${user.name}'s Schedule`,
        timezone: 'America/Los_Angeles',
        ttl: 60 // Update every hour
      });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department',
          url: `${req.protocol}://${req.get('host')}/provider/${userId}`
        });
      });

      // Set headers for calendar feed
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Chat Routes
  app.get("/api/chat/rooms", async (req, res) => {
    try {
      const result = await db.query.chatRooms.findMany({
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/rooms", async (req, res) => {
    try {
      const { name, type, memberIds } = req.body;
      const createdBy = req.user?.id; // Assuming authentication is set up

      if (!createdBy) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [room] = await db.insert(chatRooms)
        .values({
          name,
          type,
          createdBy
        })
        .returning();

      // Add members to the room
      await db.insert(roomMembers)
        .values(
          memberIds.map((userId: number) => ({
            roomId: room.id,
            userId,
            role: userId === createdBy ? 'admin' : 'member'
          }))
        );

      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, parseInt(id)),
        with: {
          members: {
            with: {
              user: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query.messages.findMany({
        where: eq(messages.roomId, parseInt(id)),
        with: {
          sender: true
        },
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, messageType = 'text', metadata = {} } = req.body;
      const senderId = req.user?.id; // Get user ID from authenticated session

      if (!senderId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [message] = await db.insert(messages)
        .values({
          roomId: parseInt(id),
          senderId,
          content,
          messageType,
          metadata
        })
        .returning();

      // Get the sender information
      const sender = await db.query.users.findFirst({
        where: eq(users.id, senderId)
      });

      if (sender) {
        // Broadcast the message to all room members
        broadcastToRoom(parseInt(id), notify.chatMessage(message, { id: parseInt(id) }, {
          name: sender.name,
          title: sender.title
        }));
      }

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calendar Export Routes
  app.get("/api/schedules/:userId/google", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate Google Calendar URL
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Google Calendar requires specific parameters
      const googleUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(
        `${req.protocol}://${req.get('host')}/api/schedules/${userId}/feed`
      )}`;

      res.redirect(googleUrl);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/outlook", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate iCal data
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Set headers for Outlook webcal subscription
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${user.name}-schedule.ics"`);
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/ical", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate iCal data
      const calendar = ical({ name: `${user.name}'s Schedule` });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department'
        });
      });

      // Set headers for iCal download
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${user.name}-schedule.ics"`);
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedules/:userId/feed", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(userId))
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userShifts = await db.query.shifts.findMany({
        where: eq(shifts.userId, parseInt(userId)),
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Generate calendar feed
      const calendar = ical({
        name: `${user.name}'s Schedule`,
        timezone: 'America/Los_Angeles',
        ttl: 60 // Update every hour
      });

      userShifts.forEach(shift => {
        calendar.createEvent({
          start: new Date(shift.startDate),
          end: new Date(shift.endDate),
          summary: `${user.name} - ICU Shift`,
          description: `Status: ${shift.status}\nSource: ${shift.source}`,
          location: 'ICU Department',
          url: `${req.protocol}://${req.get('host')}/provider/${userId}`
        });
      });

      // Set headers for calendar feed
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(calendar.toString());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return server;
}