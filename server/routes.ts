import express from 'express';
import { Server } from 'http';
import { db } from '../db';
import { users, shifts, userPreferences, timeOffRequests, swapRequests } from '@db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';

export function registerRoutes(app: express.Application) {
  const server = new Server(app);
  const { broadcast } = setupWebSocket(server);

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

  // Request shift swap
  app.post("/api/shifts/:id/swap-request", async (req, res) => {
    try {
      const { id } = req.params;
      const { targetUserId } = req.body;

      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, parseInt(id)),
        with: {
          user: true
        }
      });

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId)
      });

      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Here you would create a swap request record
      // For now, we'll just broadcast the request
      if (shift.user) {
        broadcast(notify.swapRequested(shift, {
          requestor: {
            name: shift.user.name,
            title: shift.user.title
          },
          target: {
            name: targetUser.name,
            title: targetUser.title
          }
        }));
      }

      res.json({ message: "Swap request sent" });
    } catch (error: any) {
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

      const query = userId
        ? db.query.timeOffRequests.findMany({
            where: eq(timeOffRequests.userId, parseInt(userId as string)),
            orderBy: (timeOffRequests, { desc }) => [desc(timeOffRequests.createdAt)]
          })
        : db.query.timeOffRequests.findMany({
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
          status: 'pending'
        })
        .returning();

      // Send notification
      broadcast(notify.timeOffRequested(request, {
        name: user.name,
        title: user.title
      }));

      res.json(request);
    } catch (error: any) {
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
          status,
          reason: reason || null
        })
        .where(eq(timeOffRequests.id, parseInt(id)))
        .returning();

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

  return server;
}