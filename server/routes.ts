import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from '../db';
import { users, shifts, swapRequests } from '@db/schema';
import { and, eq, sql, or } from 'drizzle-orm';
import { setupWebSocket, notify, type WebSocketInterface } from './websocket';
import { log } from './vite';

function getShiftDuration(shift: any): number {
  const startDate = new Date(shift.startDate);
  const endDate = new Date(shift.endDate);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export async function registerRoutes(app: Express): Promise<{ server: Server, cleanup?: () => Promise<void> }> {
  const server = createServer(app);
  let ws: WebSocketInterface | undefined;

  try {
    ws = await setupWebSocket(server);
    log('WebSocket server initialized successfully');
  } catch (error) {
    console.error('WebSocket setup error:', error);
    log('Continuing without WebSocket support...');
  }

  // Swap Request Routes
  app.get("/api/swap-requests", async (req, res) => {
    try {
      const { userId } = req.query;
      log(`Fetching swap requests${userId ? ` for user ${userId}` : ''}`);

      const requests = await db.query.swapRequests.findMany({
        where: userId ?
          or(
            eq(swapRequests.requestorId, parseInt(userId as string)),
            eq(swapRequests.recipientId, parseInt(userId as string))
          )
          : undefined,
        orderBy: (swapRequests, { desc }) => [desc(swapRequests.createdAt)],
        with: {
          shift: {
            columns: {
              id: true,
              startDate: true,
              endDate: true,
              status: true
            },
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  title: true,
                  color: true
                }
              }
            }
          },
          requestor: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      // Format dates for the response
      const formattedRequests = requests.map(req => ({
        ...req,
        shift: req.shift ? {
          ...req.shift,
          startDate: new Date(req.shift.startDate).toISOString(),
          endDate: new Date(req.shift.endDate).toISOString(),
        } : null
      }));

      log(`Found ${requests.length} swap requests`);
      res.json(formattedRequests);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch swap requests' });
    }
  });

  // Create swap request
  app.post("/api/swap-requests", async (req, res) => {
    try {
      const { shiftId, requestorId, recipientId } = req.body;
      log(`Creating swap request: ${requestorId} -> ${recipientId} for shift ${shiftId}`);

      // First check if a pending request already exists
      const existingRequest = await db.query.swapRequests.findFirst({
        where: and(
          eq(swapRequests.shiftId, shiftId),
          eq(swapRequests.status, 'pending')
        )
      });

      if (existingRequest) {
        return res.status(400).json({ message: 'A pending swap request already exists for this shift' });
      }

      const [newSwapRequest] = await db.insert(swapRequests)
        .values({
          shiftId: Number(shiftId),
          requestorId: Number(requestorId),
          recipientId: Number(recipientId),
          status: 'pending',
          createdAt: new Date(),
        })
        .returning();

      if (!newSwapRequest) {
        throw new Error('Failed to create swap request');
      }

      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
        columns: {
          id: true,
          startDate: true,
          endDate: true,
          status: true
        }
      });

      if (!shift) {
        throw new Error('Associated shift not found');
      }

      const requestor = await db.query.users.findFirst({
        where: eq(users.id, requestorId),
        columns: {
          id: true,
          name: true,
          title: true,
          color: true
        }
      });

      const recipient = await db.query.users.findFirst({
        where: eq(users.id, recipientId),
        columns: {
          id: true,
          name: true,
          title: true,
          color: true
        }
      });

      if (!requestor || !recipient) {
        throw new Error('Could not find required user information');
      }

      // Format dates and prepare notification payload
      const notificationShift = {
        ...shift,
        startDate: new Date(shift.startDate).toISOString(),
        endDate: new Date(shift.endDate).toISOString(),
      };

      // Send notification only if WebSocket is available
      if (ws) {
        try {
          ws.broadcast(notify.shiftSwapRequested(
            notificationShift,
            requestor,
            recipient,
            newSwapRequest.id
          ));
          log('Swap request notification sent successfully');
        } catch (error) {
          console.error('Failed to send swap request notification:', error);
          // Continue even if notification fails
        }
      }

      // Return the complete swap request with all related data
      const completeSwapRequest = await db.query.swapRequests.findFirst({
        where: eq(swapRequests.id, newSwapRequest.id),
        with: {
          shift: {
            columns: {
              id: true,
              startDate: true,
              endDate: true,
              status: true
            }
          },
          requestor: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      if (!completeSwapRequest?.shift) {
        throw new Error('Failed to fetch complete swap request details');
      }

      // Format dates in the response
      const formattedResponse = {
        ...completeSwapRequest,
        shift: {
          ...completeSwapRequest.shift,
          startDate: new Date(completeSwapRequest.shift.startDate).toISOString(),
          endDate: new Date(completeSwapRequest.shift.endDate).toISOString(),
        }
      };

      res.json(formattedResponse);
    } catch (error) {
      console.error('Error creating swap request:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to create swap request' });
    }
  });

  // Respond to swap request
  app.post("/api/swap-requests/:id/respond", async (req, res) => {
    try {
      const { status } = req.body;
      const id = parseInt(req.params.id);
      log(`Responding to swap request ${id} with status: ${status}`);

      const request = await db.query.swapRequests.findFirst({
        where: eq(swapRequests.id, id),
        with: {
          shift: {
            columns: {
              id: true,
              startDate: true,
              endDate: true,
              status: true
            },
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  title: true,
                  color: true
                }
              }
            }
          },
          requestor: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              id: true,
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      if (!request || !request.shift) {
        return res.status(404).json({ message: 'Swap request not found' });
      }

      const [updatedRequest] = await db.update(swapRequests)
        .set({ status })
        .where(eq(swapRequests.id, id))
        .returning();

      if (status === 'accepted') {
        // Update shift status
        await db.update(shifts)
          .set({ status: 'swapped' })
          .where(eq(shifts.id, request.shift.id));
      }

      // Send notification with formatted dates
      const formattedShift = {
        ...request.shift,
        startDate: new Date(request.shift.startDate).toISOString(),
        endDate: new Date(request.shift.endDate).toISOString(),
      };

      if (ws) {
        try {
          ws.broadcast(notify.shiftSwapResponded(
            formattedShift,
            request.requestor,
            request.recipient,
            status as 'accepted' | 'rejected'
          ));
          log('Swap request response notification sent successfully');
        } catch (error) {
          console.error('Failed to send swap request response notification:', error);
          // Continue even if notification fails
        }
      }

      log(`Swap request ${id} response processed and notification sent`);
      res.json(updatedRequest);
    } catch (error) {
      console.error('Error responding to swap request:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to respond to swap request' });
    }
  });

  // Get all shifts with user details
  app.get("/api/shifts", async (_req, res) => {
    try {
      const allShifts = await db.query.shifts.findMany({
        with: {
          user: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      // Format dates in the response
      const formattedShifts = allShifts.map(shift => ({
        ...shift,
        startDate: new Date(shift.startDate).toISOString(),
        endDate: new Date(shift.endDate).toISOString(),
      }));

      res.json(formattedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch shifts' });
    }
  });

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch users' });
    }
  });

  // Analytics Routes
  app.get("/api/analytics/workload", async (_req, res) => {
    try {
      const workloadData = await db.query.shifts.findMany({
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              targetDays: true,
              userType: true,
            }
          }
        }
      });

      // Calculate workload metrics
      const userWorkloads = workloadData.reduce((acc, shift) => {
        if (!shift.user) return acc;

        const days = getShiftDuration(shift);
        const userId = shift.user.id;

        if (!acc[userId]) {
          acc[userId] = {
            name: shift.user.name,
            actualDays: 0,
            targetDays: shift.user.targetDays,
            utilization: 0
          };
        }

        acc[userId].actualDays += days;
        acc[userId].utilization = (acc[userId].actualDays / shift.user.targetDays) * 100;

        return acc;
      }, {} as Record<number, {
        name: string;
        actualDays: number;
        targetDays: number;
        utilization: number;
      }>);

      res.json(Object.values(userWorkloads));
    } catch (error) {
      console.error('Error fetching workload analytics:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch workload analytics' });
    }
  });

  app.get("/api/analytics/distribution", async (_req, res) => {
    try {
      const shiftData = await db.query.shifts.findMany({
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              userType: true,
            }
          }
        }
      });

      // Calculate distribution metrics by user type
      const distribution = shiftData.reduce((acc, shift) => {
        if (!shift.user) return acc;

        const userType = shift.user.userType;
        const days = getShiftDuration(shift);

        if (!acc[userType]) {
          acc[userType] = {
            totalDays: 0,
            shiftCount: 0,
            avgShiftLength: 0
          };
        }

        acc[userType].totalDays += days;
        acc[userType].shiftCount += 1;
        acc[userType].avgShiftLength = acc[userType].totalDays / acc[userType].shiftCount;

        return acc;
      }, {} as Record<string, {
        totalDays: number;
        shiftCount: number;
        avgShiftLength: number;
      }>);

      res.json(Object.entries(distribution).map(([type, metrics]) => ({
        type,
        ...metrics
      })));
    } catch (error) {
      console.error('Error fetching distribution analytics:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch distribution analytics' });
    }
  });

  app.get("/api/analytics/fatigue", async (_req, res) => {
    try {
      const shifts = await db.query.shifts.findMany({
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              maxConsecutiveWeeks: true,
            }
          }
        },
        orderBy: (shifts, { asc }) => [asc(shifts.startDate)]
      });

      // Calculate consecutive weeks and fatigue risk
      const userConsecutiveWeeks = shifts.reduce((acc, shift) => {
        if (!shift.user) return acc;

        const userId = shift.user.id;
        const weekStart = new Date(shift.startDate);
        weekStart.setHours(0, 0, 0, 0);

        if (!acc[userId]) {
          acc[userId] = {
            name: shift.user.name,
            maxAllowed: shift.user.maxConsecutiveWeeks,
            currentConsecutive: 1,
            fatigueRisk: 'low'
          };
        } else {
          // Check if this shift starts in the next consecutive week
          const lastShift = shifts.find(s =>
            s.userId === userId &&
            new Date(s.endDate) < weekStart
          );

          if (lastShift) {
            const weekDiff = Math.round(
              (weekStart.getTime() - new Date(lastShift.endDate).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
            );

            if (weekDiff <= 1) {
              acc[userId].currentConsecutive += 1;
            } else {
              acc[userId].currentConsecutive = 1;
            }
          }

          // Calculate fatigue risk
          const riskRatio = acc[userId].currentConsecutive / acc[userId].maxAllowed;
          acc[userId].fatigueRisk = riskRatio >= 1 ? 'high' :
            riskRatio >= 0.7 ? 'medium' : 'low';
        }

        return acc;
      }, {} as Record<number, {
        name: string;
        maxAllowed: number;
        currentConsecutive: number;
        fatigueRisk: 'low' | 'medium' | 'high';
      }>);

      res.json(Object.values(userConsecutiveWeeks));
    } catch (error) {
      console.error('Error fetching fatigue analytics:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch fatigue analytics' });
    }
  });

  return { server, cleanup: ws?.cleanup };
}