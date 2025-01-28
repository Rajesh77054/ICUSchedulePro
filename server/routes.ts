import type { Express } from "express";
import { createServer, type Server } from "http";
import { log } from './vite';
import { db } from "@db";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    log('Health check requested');
    res.json({ status: "ok" });
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