import type { Express } from "express";
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

  // Get all shifts - simplified mock response
  app.get("/api/shifts", (_req, res) => {
    res.json([]);
  });

  // Get all users - simplified mock response
  app.get("/api/users", (_req, res) => {
    res.json([]);
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