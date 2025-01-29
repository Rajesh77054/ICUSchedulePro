import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { serviceOrchestrator } from "./services/orchestration";
import type { ServiceState } from "./services/orchestration";

interface ServerHealth {
  status: 'healthy' | 'degraded' | 'failed';
  services: Record<string, ServiceState>;
  uptime: number;
  startTime: Date;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Track active connections for proper cleanup
  const activeConnections = new Set<any>();
  const startTime = new Date();

  // Add JSON and URL-encoded parsing middleware first
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware with JSON response capture
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    const serviceHealth = await serviceOrchestrator.checkHealth();

    const health: ServerHealth = {
      status: 'healthy',
      services: serviceHealth,
      uptime: process.uptime(),
      startTime,
    };

    // Check if any services are degraded or failed
    Object.values(serviceHealth).forEach(state => {
      if (state.status === 'failed') {
        health.status = 'failed';
      } else if (state.status === 'degraded' && health.status !== 'failed') {
        health.status = 'degraded';
      }
    });

    res.json(health);
  });

  // Track connections for cleanup
  app.use((req, res, next) => {
    const socket = req.socket;
    if (socket) {
      activeConnections.add(socket);
      socket.once('close', () => {
        activeConnections.delete(socket);
      });
    }
    next();
  });

  // Cleanup function
  const cleanup = async () => {
    log('Starting graceful shutdown...');

    // Stop all services
    try {
      await serviceOrchestrator.shutdown();
      log('Services stopped successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
    }

    // Close all active connections
    activeConnections.forEach((socket) => {
      socket.destroy();
    });
    activeConnections.clear();

    // Close the server
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  };

  // Handle graceful shutdown
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);

  try {
    // Phase 1: Initialize Services
    log('Initializing services...');
    await serviceOrchestrator.initialize();
    log('Services initialized successfully');

    // Phase 2: Register Routes
    log('Registering API routes...');
    registerRoutes(app, server);

    // Phase 3: Setup Error Handling
    app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('API error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ error: message });
    });

    // Phase 4: Setup Vite or Static Files
    if (app.get("env") === "development") {
      log('Setting up Vite middleware...');
      await setupVite(app, server);
      log('Vite middleware setup complete');
    } else {
      log('Setting up static file serving...');
      serveStatic(app);
    }

    // Phase 5: Start Server with Port Fallback
    const startServerOnPort = (port: number) => {
      server.listen(port, "0.0.0.0", () => {
        log(`Server running on port ${port}`);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} is busy, trying ${port + 1}...`);
          startServerOnPort(port + 1);
        } else {
          console.error('Failed to start server:', err);
          process.exit(1);
        }
      });
    };

    // Start periodic health checks
    setInterval(async () => {
      try {
        await serviceOrchestrator.checkHealth();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds

    startServerOnPort(5000);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});