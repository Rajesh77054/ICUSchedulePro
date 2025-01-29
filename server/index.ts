import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
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

// Check if a port is available
const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
};

(async () => {
  try {
    // Create HTTP server
    const server = createServer(app);

    // Register routes and WebSocket handlers
    registerRoutes(app);

    // Error handling middleware
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

    // Cleanup function for graceful shutdown
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

    // Find available port and start server
    const startServer = async (initialPort: number = 5000): Promise<void> => {
      let currentPort = initialPort;
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isAvailable = await isPortAvailable(currentPort);

        if (isAvailable) {
          return new Promise((resolve, reject) => {
            server.listen(currentPort, '0.0.0.0')
              .once('listening', () => {
                log(`Server running on port ${currentPort}`);
                resolve();
              })
              .once('error', (err) => {
                reject(err);
              });
          });
        }

        log(`Port ${currentPort} is in use`);
        currentPort++;
      }

      throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
    };

    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();