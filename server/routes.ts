import type { Express } from "express";
import { log } from './vite';
import { db } from "@db";
import os from 'os';
import { type WebSocketInterface } from './websocket';
import { OpenAIChatHandler } from './openai-handler';
import {
  shifts,
  swapRequests,
  chatRooms,
  users,
  roomMembers,
  messages
} from "@db/schema";
import { eq, and, or, gte, asc } from "drizzle-orm";
import { format } from "date-fns";
import { notify } from './websocket';
import { createServer, type Server } from "http";

interface ServerMetrics {
  uptime: number;
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  activeConnections: number;
  lastUpdated: string;
}

let metrics: ServerMetrics = {
  uptime: 0,
  cpuUsage: 0,
  memoryUsage: {
    total: 0,
    used: 0,
    free: 0
  },
  activeConnections: 0,
  lastUpdated: new Date().toISOString()
};

let metricsInterval: NodeJS.Timeout;

export async function initializeServer(app: Express): Promise<Server> {
  // Clear existing intervals if they exist
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  const httpServer = createServer(app);

  // Setup cleanup handlers
  httpServer.on('close', () => {
    if (metricsInterval) {
      clearInterval(metricsInterval);
    }
  });

  return httpServer;
}

export function registerRoutes(app: Express, ws: WebSocketInterface) {
  // Setup metrics update interval
  metricsInterval = setInterval(() => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    metrics = {
      uptime: process.uptime(),
      cpuUsage: os.loadavg()[0],
      memoryUsage: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem
      },
      activeConnections: ws.clients.size,
      lastUpdated: new Date().toISOString()
    };

    // Broadcast metrics update
    ws.broadcast({
      type: 'metrics_update',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  }, 5000);

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Get metrics for server health monitoring
  app.get("/api/metrics", (_req, res) => {
    res.json(metrics);
  });

  // Analytics endpoints
  app.get("/api/analytics/workload", (_req, res) => {
    // Mock workload data
    const workloadData = [
      { name: "Dr. Smith", actualDays: 15, targetDays: 20, utilization: 75 },
      { name: "Dr. Johnson", actualDays: 18, targetDays: 15, utilization: 120 },
      { name: "Dr. Williams", actualDays: 12, targetDays: 12, utilization: 100 }
    ];
    res.json(workloadData);
  });

  app.get("/api/analytics/distribution", (_req, res) => {
    // Mock distribution data
    const distributionData = [
      { type: "Physician", totalDays: 45, shiftCount: 15, avgShiftLength: 3 },
      { type: "APP", totalDays: 30, shiftCount: 10, avgShiftLength: 3 }
    ];
    res.json(distributionData);
  });

  app.get("/api/analytics/fatigue", (_req, res) => {
    // Mock fatigue data
    const fatigueData = [
      { name: "Dr. Smith", maxAllowed: 5, currentConsecutive: 3, fatigueRisk: "low" },
      { name: "Dr. Johnson", maxAllowed: 5, currentConsecutive: 4, fatigueRisk: "medium" },
      { name: "Dr. Williams", maxAllowed: 5, currentConsecutive: 2, fatigueRisk: "low" }
    ];
    res.json(fatigueData);
  });

  // Get all shifts - with proper implementation
  app.get("/api/shifts", async (_req, res) => {
    try {
      const now = new Date();
      const currentDateStr = format(now, 'yyyy-MM-dd');

      const allShifts = await db.select()
        .from(shifts)
        .where(
          or(
            gte(shifts.startDate, currentDateStr),
            and(
              gte(shifts.endDate, currentDateStr),
              eq(shifts.status, "confirmed")
            )
          )
        )
        .orderBy(shifts.startDate);

      // Format the response with proper date handling
      const formattedShifts = allShifts.map(shift => {
        const startDate = new Date(shift.startDate);
        const endDate = new Date(shift.endDate);
        return {
          ...shift,
          isUpcoming: startDate > now,
          isCurrent: startDate <= now && endDate >= now
        };
      });

      res.json(formattedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({
        error: "Failed to fetch shifts",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add shift creation endpoint
  app.post("/api/shifts", async (req, res) => {
    try {
      // Enhanced validation with detailed error messages
      const { userId, startDate, endDate, status, source, schedulingNotes } = req.body;

      if (!userId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          details: {
            userId: !userId ? "User ID is required" : null,
            startDate: !startDate ? "Start date is required" : null,
            endDate: !endDate ? "End date is required" : null
          }
        });
      }

      // Validate user exists
      const users = [
        { id: 1, name: "Dr. Smith", title: "Physician", color: "#0088FE", userType: "physician" },
        { id: 2, name: "Dr. Johnson", title: "Physician", color: "#00C49F", userType: "physician" },
        { id: 3, name: "Dr. Williams", title: "Physician", color: "#FFBB28", userType: "physician" },
        { id: 4, name: "Sarah Brown", title: "APP", color: "#FF8042", userType: "app" },
        { id: 5, name: "Mike Davis", title: "APP", color: "#8884d8", userType: "app" }
      ];

      const userExists = users.some(user => user.id === parseInt(userId));
      if (!userExists) {
        return res.status(400).json({
          success: false,
          error: "Invalid user",
          details: "The specified user does not exist"
        });
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid dates",
          details: "Start date and end date must be valid dates"
        });
      }

      if (end < start) {
        return res.status(400).json({
          success: false,
          error: "Invalid date range",
          details: "End date must be after start date"
        });
      }

      const newShift = {
        userId: parseInt(userId),
        startDate,
        endDate,
        status: status || 'confirmed',
        source: source || 'manual',
        schedulingNotes: schedulingNotes || {},
        createdAt: new Date()
      };

      const result = await db.insert(shifts).values(newShift).returning();

      if (!result.length) {
        throw new Error('Failed to create shift - no result returned');
      }

      // Broadcast the new shift to all connected clients
      ws.broadcast(notify.shiftChange('created', result[0]));

      res.status(201).json({
        success: true,
        message: "Shift created successfully",
        shift: result[0]
      });
    } catch (error: any) {
      console.error('Error creating shift:', error);
      res.status(500).json({
        success: false,
        error: "Failed to create shift",
        details: error.message
      });
    }
  });

  // Update shift endpoint
  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      if (!shiftId) {
        return res.status(400).json({ error: "Invalid shift ID" });
      }

      const result = await db.update(shifts)
        .set({
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          updatedAt: new Date()
        })
        .where(eq(shifts.id, shiftId))
        .returning();

      if (!result.length) {
        return res.status(404).json({ error: "Shift not found" });
      }

      // Broadcast the updated shift to all connected clients
      ws.broadcast(notify.shiftChange('updated', result[0]));

      res.json(result[0]);
    } catch (error: any) {
      console.error('Error updating shift:', error);
      res.status(500).json({
        error: "Failed to update shift",
        details: error.message
      });
    }
  });

  // Add shift deletion endpoint
  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      if (!shiftId) {
        return res.status(400).json({
          success: false,
          error: "Invalid shift ID"
        });
      }

      const result = await db.delete(shifts)
        .where(eq(shifts.id, shiftId))
        .returning();

      if (!result.length) {
        return res.status(404).json({
          success: false,
          error: "Shift not found"
        });
      }

      // Broadcast the deleted shift to all connected clients
      ws.broadcast(notify.shiftChange('deleted', result[0]));

      res.json({
        success: true,
        message: "Shift deleted successfully",
        deletedShift: result[0]
      });
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      res.status(500).json({
        success: false,
        error: "Failed to delete shift",
        details: error.message
      });
    }
  });

  // Get all users - with proper implementation
  app.get("/api/users", async (_req, res) => {
    try {
      // Mock user data for now - should be replaced with actual DB query
      const users = [
        { id: 1, name: "Dr. Smith", title: "Physician", color: "#0088FE", userType: "physician" },
        { id: 2, name: "Dr. Johnson", title: "Physician", color: "#00C49F", userType: "physician" },
        { id: 3, name: "Dr. Williams", title: "Physician", color: "#FFBB28", userType: "physician" },
        { id: 4, name: "Sarah Brown", title: "APP", color: "#FF8042", userType: "app" },
        { id: 5, name: "Mike Davis", title: "APP", color: "#8884d8", userType: "app" }
      ];
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Historical patterns endpoint
  app.get("/api/scheduling/historical-patterns", async (_req, res) => {
    try {
      const now = new Date();
      const currentDateStr = format(now, 'yyyy-MM-dd');
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

      const shiftPatterns = await db.select()
        .from(shifts)
        .where(
          or(
            gte(shifts.startDate, currentDateStr),
            and(
              gte(shifts.startDate, thirtyDaysAgoStr),
              eq(shifts.status, "confirmed")
            )
          )
        )
        .orderBy(shifts.startDate);

      const patterns = {
        preferredShifts: analyzePreferredShifts(shiftPatterns),
        currentAndUpcomingShifts: shiftPatterns.map(shift => {
          const startDate = new Date(shift.startDate);
          const endDate = new Date(shift.endDate);
          return {
            ...shift,
            isUpcoming: startDate > now,
            isCurrent: startDate <= now && endDate >= now
          };
        })
      };

      res.json(patterns);
    } catch (error) {
      console.error('Error fetching historical patterns:', error);
      res.status(500).json({
        error: "Failed to fetch historical patterns",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add chat endpoint with proper error handling
  app.post("/api/chat", async (req, res) => {
    try {
      if (!req.body?.message) {
        return res.status(400).json({
          error: "Missing message in request body",
          content: null
        });
      }

      const openAIHandler = new OpenAIChatHandler();
      const response = await openAIHandler.handleChat(
        req.body.message,
        req.body.pageContext || {}
      );

      if (!response) {
        throw new Error('Failed to get response from AI handler');
      }

      res.json({ content: response });

    } catch (error: any) {
      console.error('Chat API Error:', error);
      res.status(500).json({
        error: error.message || 'Internal server error',
        content: null
      });
    }
  });

  // Add swap requests endpoints
  app.get("/api/swap-requests", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

      // Mock user data for now since we haven't implemented the full user system
      const users = [
        { id: 1, name: "Dr. Smith", title: "Physician" },
        { id: 2, name: "Dr. Johnson", title: "Physician" },
        { id: 3, name: "Dr. Williams", title: "Physician" },
        { id: 4, name: "Sarah Brown", title: "APP" },
        { id: 5, name: "Mike Davis", title: "APP" }
      ];

      // Get all swap requests with their associated shifts
      const requests = await db.query.swapRequests.findMany({
        where: userId ?
          or(
            eq(swapRequests.requestorId, userId),
            eq(swapRequests.recipientId, userId)
          ) : undefined,
        with: {
          shift: true // Include the related shift data
        }
      });

      // Enhance the requests with user data and ensure proper date formatting
      const enhancedRequests = requests.map(request => {
        // Format the shift dates if they exist
        const formattedShift = request.shift ? {
          ...request.shift,
          // Ensure dates are properly formatted strings
          startDate: request.shift.startDate,
          endDate: request.shift.endDate
        } : null;

        return {
          ...request,
          shift: formattedShift,
          requestor: users.find(u => u.id === request.requestorId) || {
            id: request.requestorId,
            name: `User ${request.requestorId}`,
            title: "Unknown"
          },
          recipient: users.find(u => u.id === request.recipientId) || {
            id: request.recipientId,
            name: `User ${request.recipientId}`,
            title: "Unknown"
          }
        };
      });

      console.log('Enhanced requests with shift data:', enhancedRequests);

      res.setHeader('Content-Type', 'application/json');
      res.json(enhancedRequests);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
      res.status(500).json({
        error: "Failed to fetch swap requests",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/swap-requests", async (req, res) => {
    try {
      const { requestorId, recipientId, shiftId, notes } = req.body;

      if (!requestorId || !recipientId || !shiftId) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "requestorId, recipientId, and shiftId are required"
        });
      }

      const [newRequest] = await db
        .insert(swapRequests)
        .values({
          requestorId,
          recipientId,
          shiftId,
          status: 'pending',
          notes: notes || '',
          createdAt: new Date(),
        })
        .returning();

      res.setHeader('Content-Type', 'application/json');
      res.status(201).json(newRequest);
    } catch (error) {
      console.error('Error creating swap request:', error);
      res.status(500).json({
        error: "Failed to create swap request",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put("/api/swap-requests/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { status } = req.body;

      if (!requestId || !status) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "request ID and status are required"
        });
      }

      const [updatedRequest] = await db
        .update(swapRequests)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(swapRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        return res.status(404).json({ error: "Swap request not found" });
      }

      res.setHeader('Content-Type', 'application/json');
      res.json(updatedRequest);
    } catch (error) {
      console.error('Error updating swap request:', error);
      res.status(500).json({
        error: "Failed to update swap request",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete("/api/swap-requests/:id", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);

      const [deletedRequest] = await db
        .delete(swapRequests)
        .where(eq(swapRequests.id, requestId))
        .returning();

      if (!deletedRequest) {
        return res.status(404).json({ error: "Swap request not found" });
      }

      res.setHeader('Content-Type', 'application/json');
      res.json({ success: true, message: "Swap request deleted successfully" });
    } catch (error) {
      console.error('Error deleting swap request:', error);
      res.status(500).json({
        error: "Failed to delete swap request",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/swap-requests/:id/respond", async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { status } = req.body;

      if (!requestId || !status || !['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({
          error: "Invalid request",
          details: "Request ID and valid status (accepted/rejected) are required"
        });
      }

      // Start a transaction
      await db.transaction(async (tx) => {
        // 1. Get the swap request with shift details
        const [request] = await tx
          .select()
          .from(swapRequests)
          .where(eq(swapRequests.id, requestId));

        if (!request) {
          throw new Error("Swap request not found");
        }

        // Update the swap request status
        await tx
          .update(swapRequests)
          .set({
            status,
            updatedAt: new Date()
          })
          .where(eq(swapRequests.id, requestId));

        // If accepted, update the shift assignment
        if (status === 'accepted' && request.shiftId) {
          // Get the shift details
          const [shift] = await tx
            .select()
            .from(shifts)
            .where(eq(shifts.id, request.shiftId));

          if (!shift) {
            throw new Error("Associated shift not found");
          }

          // Update the shift's userId to the recipient
          await tx
            .update(shifts)
            .set({
              userId: request.recipientId,
              updatedAt: new Date()
            })
            .where(eq(shifts.id, request.shiftId));
        }
      });

      // Send success response
      res.json({
        success: true,
        message: `Swap request ${status}`,
      });

    } catch (error) {
      console.error('Error responding to swap request:', error);
      res.status(500).json({
        error: "Failed to process swap request response",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Chat room endpoints
  app.get("/api/chat/rooms/:id", async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ error: "Invalid room ID" });
      }

      // Query the chat room directly from the database
      const rooms = await db.select()
        .from(chatRooms)
        .where(eq(chatRooms.id, roomId));

      if (!rooms.length) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const room = rooms[0];

      // Get room members
      const members = await db.select({
        id: users.id,
        name: users.name,
        title: users.title
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, roomId));

      // Format the response
      const formattedRoom = {
        id: room.id,
        name: room.name,
        type: room.type,
        members
      };

      res.json(formattedRoom);
    } catch (error) {
      console.error('Error fetching chat room:', error);
      res.status(500).json({
        error: "Failed to fetch chat room",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ error: "Invalid room ID" });
      }

      const messagesWithSenders = await db.select({
        id: messages.id,
        content: messages.content,
        messageType: messages.messageType,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        sender: {
          name: users.name,
          title: users.title
        }
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.roomId, roomId))
      .orderBy(asc(messages.createdAt));

      // Format the response
      const formattedMessages = messagesWithSenders.map(msg => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata,
        createdAt: msg.createdAt?.toISOString(),
        sender: msg.sender
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        error: "Failed to fetch messages",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/chat/rooms/:id/messages", async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const { content, senderId } = req.body;

      if (!content || !senderId) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "Content and sender ID are required"
        });
      }

      // Insert the new message
      const [newMessage] = await db.insert(messages)
        .values({
          roomId,
          senderId,
          content,
          messageType: 'text',
          createdAt: new Date()
        })
        .returning();

      // Get the sender details
      const sender = await db.select({
        name: users.name,
        title: users.title
      })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);

      // Format the response
      const formattedMessage = {
        ...newMessage,
        createdAt: newMessage.createdAt?.toISOString(),
        sender: sender[0] || {
          name: 'Unknown User',
          title: 'Unknown'
        }
      };

      // Broadcast the new message to all connected clients
      ws.broadcast({
        type: 'chat_message',
        data: formattedMessage,
        timestamp: new Date().toISOString()
      });

      res.status(201).json(formattedMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        error: "Failed to send message",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

}

// Helper functions for pattern analysis
function analyzePreferredShifts(shifts: any[]) {
  // Implementation would analyze shift patterns to identify preferences
  return [];
}

function analyzeSwapPatterns(swaps: any[]) {
  // Implementation would analyze swap request patterns
  return [];
}

function summarizeWorkloadHistory(history: any[]) {
  // Implementation would summarize historical workload data
  return [];
}

function analyzeConsecutivePatterns(patterns: any[]) {
  // Implementation would analyze patterns in consecutive shifts
  return [];
}

// Update active connections count
export function updateMetricsConnections(count: number) {
  metrics.activeConnections = count;
}

export { metrics };