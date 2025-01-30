import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, initializeServer } from "./routes";
import { setupVite, log } from "./vite";
import net from "net";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Track active connections for proper cleanup
const activeConnections = new Set<any>();

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

const findAvailablePort = async (startPort: number, maxAttempts: number = 10): Promise<number> => {
  log(`Checking port availability starting from ${startPort}`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = net.createServer()
          .once('error', (err) => {
            log(`Port ${port} is in use: ${err.message}`);
            testServer.close();
            resolve();
          })
          .once('listening', () => {
            log(`Found available port: ${port}`);
            testServer.close(() => resolve());
          })
          .listen(port, '0.0.0.0');
      });
      return port;
    } catch (err) {
      log(`Error testing port ${port}: ${err}`);
      continue;
    }
  }
  throw new Error(`No available port found after ${maxAttempts} attempts`);
};

(async () => {
  try {
    // Find an available port first
    const port = await findAvailablePort(3000);

    // Register routes before setting up Vite
    registerRoutes(app);

    // Initialize server with WebSocket support
    const server = await initializeServer(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      res.status(status).json({ message });
    });

    // Setup Vite middleware in development
    if (app.get("env") === "development") {
      await setupVite(app, server);
    }

    // Setup graceful shutdown with proper connection draining
    const cleanup = async () => {
      log('Starting graceful shutdown...');

      // Set a timeout for force shutdown
      const forceShutdownTimeout = setTimeout(() => {
        log('Force closing remaining connections');
        process.exit(1);
      }, 10000);

      try {
        // Close all active connections
        const closePromises = Array.from(activeConnections).map(socket => 
          new Promise<void>(resolve => {
            socket.destroy();
            resolve();
          })
        );

        await Promise.all(closePromises);
        activeConnections.clear();

        server.close(() => {
          log('Server closed successfully');
          clearTimeout(forceShutdownTimeout);
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
      }
    };

    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);

    // Start server
    server.listen(port, '0.0.0.0', () => {
      log(`Server started on port ${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();