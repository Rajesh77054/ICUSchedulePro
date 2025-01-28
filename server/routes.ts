import type { Express } from "express";
import { createServer, type Server } from "http";
import { log } from './vite';
import { db } from "@db";
import os from 'os';
import { setupWebSocket } from './websocket';
import { conflictResolutionService } from './services/conflict-resolution';
import { notificationService } from './services/notification';
import { 
  schedulingRules, 
  conflicts,
  resolutionAttempts,
  notifications,
  notificationSubscriptions,
  type ResolutionStrategy,
  type NotificationChannel
} from "@db/schema";
import { eq, and } from "drizzle-orm";

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

// Update metrics every 5 seconds
const metricsInterval = setInterval(() => {
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
    activeConnections: 0, // Will be updated by WebSocket server
    lastUpdated: new Date().toISOString()
  };
}, 5000);

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Initialize WebSocket server after HTTP server creation
  let wsInitialized = false;

  httpServer.on('listening', async () => {
    if (!wsInitialized) {
      try {
        const ws = await setupWebSocket(httpServer);
        wsInitialized = true;

        // Update metrics with WebSocket connections
        setInterval(() => {
          if (ws.clients) {
            metrics.activeConnections = ws.clients.size;
          }
          ws.broadcast({
            type: 'metrics_update',
            data: metrics,
            timestamp: new Date().toISOString()
          });
        }, 5000);

        log('WebSocket server initialized successfully');
      } catch (error) {
        console.error('Failed to initialize WebSocket server:', error);
      }
    }
  });

  // Cleanup on server close
  httpServer.on('close', () => {
    clearInterval(metricsInterval);
  });

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", wsInitialized });
  });

  // Get server metrics
  app.get("/api/metrics", (_req, res) => {
    res.json(metrics);
  });

  // Scheduling Rules Endpoints
  app.get("/api/scheduling-rules", async (_req, res) => {
    try {
      const rules = await db.query.schedulingRules.findMany();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scheduling rules" });
    }
  });

  app.post("/api/scheduling-rules", async (req, res) => {
    try {
      const rule = await db.insert(schedulingRules).values(req.body).returning();
      res.json(rule[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create scheduling rule" });
    }
  });

  // Conflicts Endpoints
  app.get("/api/conflicts", async (_req, res) => {
    try {
      const activeConflicts = await db.query.conflicts.findMany({
        where: eq(conflicts.status, 'detected'),
      });
      res.json(activeConflicts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conflicts" });
    }
  });

  app.post("/api/conflicts/:id/resolve", async (req, res) => {
    try {
      const conflictId = parseInt(req.params.id);
      const strategy = req.body.strategy as ResolutionStrategy;

      const success = await conflictResolutionService.resolveConflict(
        conflictId,
        strategy
      );

      if (success) {
        res.json({ status: "resolved" });
      } else {
        res.status(400).json({ error: "Failed to resolve conflict" });
      }
    } catch (error) {
      res.status(500).json({ error: "Error processing conflict resolution" });
    }
  });

  // Resolution Attempts Endpoints
  app.get("/api/conflicts/:id/attempts", async (req, res) => {
    try {
      const conflictId = parseInt(req.params.id);
      const attempts = await db.query.resolutionAttempts.findMany({
        where: eq(resolutionAttempts.conflictId, conflictId),
      });
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch resolution attempts" });
    }
  });

  // Get all shifts
  app.get("/api/shifts", async (_req, res) => {
    try {
      // For now, return empty array until we implement the database
      res.json([]);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  // Get all users
  app.get("/api/users", async (_req, res) => {
    try {
      // For now, return empty array until we implement the database
      res.json([]);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Notification Endpoints
  app.post("/api/notifications/subscribe", async (req, res) => {
    try {
      const { userId, channel, endpoint, keys } = req.body;
      const subscription = await db.insert(notificationSubscriptions)
        .values({
          userId,
          channel: channel as NotificationChannel,
          endpoint,
          keys: keys || {},
        })
        .returning();

      res.json(subscription[0]);
    } catch (error) {
      console.error('Error creating notification subscription:', error);
      res.status(500).json({ error: "Failed to create notification subscription" });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const userNotifications = await notificationService.getUserNotifications(userId);
      res.json(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = parseInt(req.body.userId);

      await notificationService.markAsRead(notificationId, userId);
      res.json({ status: "success" });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/subscription", async (req, res) => {
    try {
      const { userId, channel } = req.body;
      await db.delete(notificationSubscriptions)
        .where(
          and(
            eq(notificationSubscriptions.userId, userId),
            eq(notificationSubscriptions.channel, channel)
          )
        );

      res.json({ status: "success" });
    } catch (error) {
      console.error('Error deleting notification subscription:', error);
      res.status(500).json({ error: "Failed to delete notification subscription" });
    }
  });

  return httpServer;
}

export { metrics };