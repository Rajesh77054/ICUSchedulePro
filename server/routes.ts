import type { Express } from "express";
import { type Server } from "http";
import { log } from './vite';
import { serviceRegistry } from './services/registry';
import type { DatabaseConnection } from '@db';
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

export function registerRoutes(app: Express, server: Server) {
  // Initialize WebSocket server after HTTP server creation
  let wsInitialized = false;
  let wsServer: any;

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", wsInitialized });
  });

  // Conflicts Endpoints with proper error handling
  app.get("/api/conflicts", async (_req, res) => {
    try {
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
      const activeConflicts = await dbService.db.query.conflicts.findMany({
        where: eq(conflicts.status, 'detected'),
      });

      res.setHeader('Content-Type', 'application/json');
      res.json(activeConflicts);
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
      res.status(500).json({ error: "Failed to fetch conflicts" });
    }
  });

  app.post("/api/conflicts/:id/resolve", async (req, res) => {
    try {
      const conflictId = parseInt(req.params.id);
      const strategy = req.body.strategy as ResolutionStrategy;

      if (!conflictId || isNaN(conflictId)) {
        return res.status(400).json({ error: "Invalid conflict ID" });
      }

      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
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
      console.error('Error processing conflict resolution:', error);
      res.status(500).json({ error: "Error processing conflict resolution" });
    }
  });

  app.get("/api/conflicts/:id/attempts", async (req, res) => {
    try {
      const conflictId = parseInt(req.params.id);
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');

      if (!conflictId || isNaN(conflictId)) {
        return res.status(400).json({ error: "Invalid conflict ID" });
      }

      const attempts = await dbService.db.query.resolutionAttempts.findMany({
        where: eq(resolutionAttempts.conflictId, conflictId),
      });
      res.json(attempts);
    } catch (error) {
      console.error('Failed to fetch resolution attempts:', error);
      res.status(500).json({ error: "Failed to fetch resolution attempts" });
    }
  });

  // Scheduling Rules Endpoints
  app.get("/api/scheduling-rules", async (_req, res) => {
    try {
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
      const rules = await dbService.db.query.schedulingRules.findMany();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scheduling rules" });
    }
  });

  app.post("/api/scheduling-rules", async (req, res) => {
    try {
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
      const rule = await dbService.db.insert(schedulingRules).values(req.body).returning();
      res.json(rule[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create scheduling rule" });
    }
  });


  // Notification Endpoints
  app.post("/api/notifications/subscribe", async (req, res) => {
    try {
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
      const { userId, channel, endpoint, keys } = req.body;
      const subscription = await dbService.db.insert(notificationSubscriptions)
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
      const dbService = serviceRegistry.getService<DatabaseConnection>('database');
      const { userId, channel } = req.body;
      await dbService.db.delete(notificationSubscriptions)
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

  // Analytics Endpoints
  app.get("/api/analytics/workload", (req, res) => {
    const timeRange = req.query.timeRange || 'month';
    const mockWorkloadData = [
      { name: "Dr. Smith", actualDays: 20, targetDays: 22, utilization: 90 },
      { name: "Dr. Johnson", actualDays: 18, targetDays: 20, utilization: 90 },
      { name: "Dr. Williams", actualDays: 15, targetDays: 18, utilization: 83 },
      { name: "Dr. Brown", actualDays: 22, targetDays: 22, utilization: 100 },
      { name: "Dr. Jones", actualDays: 19, targetDays: 20, utilization: 95 }
    ];
    res.json(mockWorkloadData);
  });

  app.get("/api/analytics/distribution", (req, res) => {
    const timeRange = req.query.timeRange || 'month';
    const mockDistributionData = [
      { type: "Day Shift", totalDays: 120, shiftCount: 60, avgShiftLength: 12 },
      { type: "Night Shift", totalDays: 80, shiftCount: 40, avgShiftLength: 12 },
      { type: "On-Call", totalDays: 40, shiftCount: 20, avgShiftLength: 24 },
      { type: "Weekend", totalDays: 60, shiftCount: 30, avgShiftLength: 12 }
    ];
    res.json(mockDistributionData);
  });

  app.get("/api/analytics/fatigue", (req, res) => {
    const timeRange = req.query.timeRange || 'month';
    const mockFatigueData = [
      { name: "Dr. Smith", maxAllowed: 5, currentConsecutive: 3, fatigueRisk: "low" },
      { name: "Dr. Johnson", maxAllowed: 5, currentConsecutive: 4, fatigueRisk: "medium" },
      { name: "Dr. Williams", maxAllowed: 5, currentConsecutive: 2, fatigueRisk: "low" },
      { name: "Dr. Brown", maxAllowed: 5, currentConsecutive: 5, fatigueRisk: "high" },
      { name: "Dr. Jones", maxAllowed: 5, currentConsecutive: 1, fatigueRisk: "low" }
    ];
    res.json(mockFatigueData);
  });

  // WebSocket setup
  server.on('listening', async () => {
    if (!wsInitialized) {
      try {
        wsServer = await setupWebSocket(server);
        wsInitialized = true;
        log('WebSocket server initialized successfully');

        // Update metrics with WebSocket connections
        setInterval(() => {
          if (wsServer && wsServer.clients) {
            metrics.activeConnections = wsServer.clients.size;
          }
          wsServer?.broadcast({
            type: 'metrics_update',
            data: metrics,
            timestamp: new Date().toISOString()
          });
        }, 5000);
      } catch (error) {
        console.error('Failed to initialize WebSocket server:', error);
      }
    }
  });

  // Cleanup on server close
  server.on('close', () => {
    clearInterval(metricsInterval);
  });

  return server;
}

export { metrics };