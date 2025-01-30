import type { Express } from "express";
import { log } from './vite';
import { db } from "@db";
import os from 'os';
import { setupWebSocket } from './websocket';
import { OpenAIChatHandler } from './openai-handler';
import { 
  schedulingRules, 
  conflicts,
  resolutionAttempts,
  notifications,
  notificationSubscriptions,
  type ResolutionStrategy,
  type NotificationChannel,
  shifts
} from "@db/schema";
import { eq, and } from "drizzle-orm";
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

  // Initialize WebSocket server
  const ws = await setupWebSocket(httpServer);

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

  // Setup cleanup handlers
  httpServer.on('close', async () => {
    if (metricsInterval) {
      clearInterval(metricsInterval);
    }
    await ws.cleanup();
  });

  return httpServer;
}

export function registerRoutes(app: Express) {
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
      const allShifts = await db.query.shifts.findMany({
        orderBy: (shifts, { desc }) => [desc(shifts.createdAt)]
      });
      res.json(allShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      res.json([]); // Return empty array for now as fallback
    }
  });

  // Add shift creation endpoint
  app.post("/api/shifts", async (req, res) => {
    try {
      if (!req.body || !req.body.userId || !req.body.startDate || !req.body.endDate) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "userId, startDate, and endDate are required"
        });
      }

      const newShift = {
        userId: req.body.userId,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: req.body.status || 'confirmed',
        source: req.body.source || 'manual',
        schedulingNotes: req.body.schedulingNotes || {},
        createdAt: new Date()
      };

      const result = await db.insert(shifts).values(newShift).returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating shift:', error);
      res.status(500).json({
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

      res.json(result[0]);
    } catch (error: any) {
      console.error('Error updating shift:', error);
      res.status(500).json({
        error: "Failed to update shift",
        details: error.message
      });
    }
  });

  // Add delete shift endpoint
  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      if (!shiftId) {
        return res.status(400).json({ error: "Invalid shift ID" });
      }

      const result = await db.delete(shifts)
        .where(eq(shifts.id, shiftId))
        .returning();

      if (!result.length) {
        return res.status(404).json({ error: "Shift not found" });
      }

      res.json({ message: "Shift deleted successfully", shift: result[0] });
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      res.status(500).json({
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

  // New endpoint for historical patterns
  app.get("/api/scheduling/historical-patterns", async (_req, res) => {
    try {
      // Fetch historical data from various sources
      const [
        shiftPatterns,
        swapHistory,
        workloadStats,
        consecutivePatterns
      ] = await Promise.all([
        db.query.shifts.findMany({
          orderBy: (shifts, { desc }) => [desc(shifts.createdAt)],
          limit: 100
        }),
        db.query.swapRequests.findMany({
          orderBy: (swaps, { desc }) => [desc(swaps.createdAt)],
          limit: 50
        }),
        db.query.workloadHistory.findMany({
          orderBy: (history, { desc }) => [desc(history.date)],
          limit: 30
        }),
        db.query.consecutiveShifts.findMany({
          orderBy: (consecutive, { desc }) => [desc(consecutive.date)],
          limit: 20
        })
      ]);

      // Process and analyze the patterns
      const patterns = {
        preferredShifts: analyzePreferredShifts(shiftPatterns),
        previousSwaps: analyzeSwapPatterns(swapHistory),
        workloadHistory: summarizeWorkloadHistory(workloadStats),
        consecutiveShiftPatterns: analyzeConsecutivePatterns(consecutivePatterns)
      };

      res.json(patterns);
    } catch (error) {
      console.error('Error fetching historical patterns:', error);
      // Return mock data for now
      res.json({
        preferredShifts: [
          { userId: 1, dayPreference: 'weekday', shiftLength: 12 },
          { userId: 2, dayPreference: 'weekend', shiftLength: 8 }
        ],
        previousSwaps: [
          { frequency: 'high', reason: 'schedule_conflict' },
          { frequency: 'medium', reason: 'personal_preference' }
        ],
        workloadHistory: [
          { period: 'last_month', averageHours: 160, satisfaction: 'high' },
          { period: 'current_month', averageHours: 155, satisfaction: 'medium' }
        ],
        consecutiveShiftPatterns: [
          { pattern: 'three_in_row', frequency: 'rare', impact: 'high' },
          { pattern: 'two_in_row', frequency: 'common', impact: 'low' }
        ]
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