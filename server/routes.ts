import type { Express } from "express";
import { createServer, type Server } from "http";
import { log } from './vite';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    log('Health check requested');
    res.json({ status: "ok" });
  });

  // Add other routes after confirming server works

  return httpServer;
}