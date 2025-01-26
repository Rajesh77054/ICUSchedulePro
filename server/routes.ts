import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from '../db';
import { users, shifts, userPreferences, timeOffRequests, swapRequests } from '@db/schema';
import { and, eq, sql, or } from 'drizzle-orm';
import { setupWebSocket, notify } from './websocket';
import { log } from './vite';

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);
  const ws = await setupWebSocket(server);

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
            with: {
              user: {
                columns: {
                  name: true,
                  title: true,
                  color: true
                }
              }
            }
          },
          requestor: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      log(`Found ${requests.length} swap requests`);
      res.json(requests);
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
          requestorId: Number(requestorId),
          recipientId: Number(recipientId),
          shiftId: Number(shiftId),
          status: 'pending',
          createdAt: new Date().toISOString()
        })
        .returning();

      if (!newSwapRequest) {
        throw new Error('Failed to create swap request');
      }

      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
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

      if (!shift) {
        throw new Error('Associated shift not found');
      }

      const requestor = await db.query.users.findFirst({
        where: eq(users.id, requestorId),
        columns: {
          name: true,
          title: true,
          color: true
        }
      });

      const recipient = await db.query.users.findFirst({
        where: eq(users.id, recipientId),
        columns: {
          name: true,
          title: true,
          color: true
        }
      });

      if (!requestor || !recipient) {
        throw new Error('Could not find all required user information');
      }

      // Send notification
      ws.broadcast(notify.shiftSwapRequested(
        shift,
        requestor,
        recipient,
        newSwapRequest.id
      ));

      log(`Swap request created and notification sent`);

      // Return the complete swap request with all related data
      const completeSwapRequest = await db.query.swapRequests.findFirst({
        where: eq(swapRequests.id, newSwapRequest.id),
        with: {
          shift: {
            with: {
              user: {
                columns: {
                  name: true,
                  title: true,
                  color: true
                }
              }
            }
          },
          requestor: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      res.json(completeSwapRequest);
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
            with: {
              user: {
                columns: {
                  name: true,
                  title: true,
                  color: true
                }
              }
            }
          },
          requestor: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          },
          recipient: {
            columns: {
              name: true,
              title: true,
              color: true
            }
          }
        }
      });

      if (!request) {
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

      // Send notification
      ws.broadcast(notify.shiftSwapResponded(
        request.shift,
        request.requestor,
        request.recipient,
        status as 'accepted' | 'rejected'
      ));

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
      res.json(allShifts);
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

  return server;
}