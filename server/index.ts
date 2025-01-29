import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const app = express();

// Track active connections for proper cleanup
const activeConnections = new Set<any>();

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

// Main setup function
(async () => {
  try {
    // Create HTTP server first
    const server = createServer(app);

    // Register API routes first before any other middleware
    registerRoutes(app, server);

    // API Error handling middleware
    app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('API error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ error: message });
    });

    // Setup Vite in development (after API routes)
    if (app.get("env") === "development") {
      log('Setting up Vite middleware...');
      await setupVite(app, server);
      log('Vite middleware setup complete');
    } else {
      log('Setting up static file serving...');
      serveStatic(app);
    }

    // Cleanup function
    const cleanup = () => {
      log('Cleaning up connections...');
      activeConnections.forEach((socket) => {
        socket.destroy();
      });
      activeConnections.clear();

      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    };

    // Handle graceful shutdown
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);

    const startServer = (port: number) => {
      server.listen(port, "0.0.0.0", () => {
        log(`Server running on port ${port}`);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} is busy, trying ${port + 1}...`);
          startServer(port + 1);
        } else {
          console.error('Failed to start server:', err);
          process.exit(1);
        }
      });
    };

    // Start with port 5000 and increment if busy
    startServer(5000);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();