import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, initializeServer } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import net from "net";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Track active connections for proper cleanup
const activeConnections = new Set<any>();

// Enhanced connection tracking middleware
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

// Enhanced connection tracking
app.use((req, _res, next) => {
  const socket = req.socket;
  if (socket) {
    activeConnections.add(socket);
    socket.once('close', () => {
      activeConnections.delete(socket);
    });
  }
  next();
});

const checkPortAvailability = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
};

const findAvailablePort = async (startPort: number, maxAttempts: number = 10): Promise<number> => {
  // Enhanced port release wait
  const portReleaseWait = 2000; // 2 seconds wait for port release
  await new Promise(resolve => setTimeout(resolve, portReleaseWait));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      const isAvailable = await checkPortAvailability(port);
      if (isAvailable) {
        // Double-check availability after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const secondCheck = await checkPortAvailability(port);
        if (secondCheck) {
          log(`Found available port: ${port}`);
          return port;
        }
      }
    } catch (error) {
      log(`Port ${port} check failed: ${error.message}`);
      continue;
    }
  }
  throw new Error(`No available port found after ${maxAttempts} attempts starting from ${startPort}`);
};

// Enhanced graceful shutdown handler
const setupGracefulShutdown = (server: net.Server) => {
  let isShuttingDown = false;

  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log('Starting graceful shutdown...');

    // Close server first to stop accepting new connections
    server.close(() => {
      log('Server stopped accepting new connections');
    });

    // Set a timeout for existing connections
    const forcedShutdownTimeout = setTimeout(() => {
      log('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);

    // Close all existing connections
    activeConnections.forEach((socket) => {
      socket.destroy();
    });
    activeConnections.clear();

    // Clear the timeout if we complete gracefully
    clearTimeout(forcedShutdownTimeout);
    log('Graceful shutdown completed');
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return cleanup;
};

(async () => {
  try {
    // Find an available port with enhanced port finding
    const port = await findAvailablePort(5000);

    // Register routes
    registerRoutes(app);

    // Initialize server with WebSocket support
    const server = await initializeServer(app);

    // Setup enhanced error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      res.status(status).json({ message });
    });

    // Setup environment-specific middleware
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Setup enhanced graceful shutdown
    const cleanup = setupGracefulShutdown(server);

    // Start server with enhanced error handling
    server.listen(port, '0.0.0.0', () => {
      log(`Server started successfully on port ${port}`);
    }).on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is in use, attempting to find another port...`);
        server.close();
      } else {
        console.error('Server error:', error);
        cleanup();
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();