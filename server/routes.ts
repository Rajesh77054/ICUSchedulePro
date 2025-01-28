import type { Express } from "express";
import { createServer, type Server } from "http";
import { log } from './vite';
import { db } from "@db";
import os from 'os';

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
setInterval(() => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  metrics = {
    uptime: process.uptime(),
    cpuUsage: os.loadavg()[0], // 1 minute load average
    memoryUsage: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem
    },
    activeConnections: 0, // Will be updated by WebSocket handler
    lastUpdated: new Date().toISOString()
  };
}, 5000);

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    log('Health check requested');
    res.json({ status: "ok" });
  });

  // Get server metrics
  app.get("/api/metrics", (_req, res) => {
    res.json(metrics);
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

  return httpServer;
}

export { metrics };