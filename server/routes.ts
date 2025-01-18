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

  return server;
}