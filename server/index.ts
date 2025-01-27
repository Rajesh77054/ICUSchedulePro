import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { createServer, type Server } from "http";
import { Socket } from "net";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Simple port check
async function ensurePortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tester = new Socket();

    tester.once('error', () => {
      tester.destroy();
      resolve(); // Port is available
    });

    tester.once('connect', () => {
      tester.destroy();
      reject(new Error(`Port ${port} is in use`));
    });

    tester.connect(port, '0.0.0.0');

    // Timeout after 1 second
    setTimeout(() => {
      tester.destroy();
      resolve();
    }, 1000);
  });
}

(async () => {
  let httpServer: Server | undefined;

  // Enhanced cleanup function
  const cleanup = async () => {
    if (httpServer) {
      log('Starting server cleanup...');

      // Close the server and wait for completion
      await new Promise<void>((resolve) => {
        if (!httpServer?.listening) {
          resolve();
          return;
        }

        httpServer.close((err) => {
          if (err) {
            console.error('Error closing server:', err);
          }
          log('Server closed');
          resolve();
        });

        // Force close remaining connections
        httpServer.emit('close');
      });

      // Wait for a moment to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      log('Cleanup completed');
    }
  };

  try {
    // Setup process termination handlers first
    process.once('SIGTERM', async () => {
      log('Received SIGTERM. Starting graceful shutdown...');
      await cleanup();
      process.exit(0);
    });

    process.once('SIGINT', async () => {
      log('Received SIGINT. Starting graceful shutdown...');
      await cleanup();
      process.exit(0);
    });

    // 1. Verify database connection
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection verified');
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error('Failed to connect to database');
    }

    // 2. Setup authentication
    try {
      await setupAuth(app);
      log('Authentication setup complete');
    } catch (error) {
      console.error('Auth setup warning:', error);
      log('Continuing without authentication...');
    }

    // 3. Create HTTP server
    httpServer = createServer(app);

    // 4. Register routes and WebSocket
    await registerRoutes(app, httpServer);
    log('Routes registered successfully');

    // 5. Setup Vite or static files
    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
      log('Vite development server setup complete');
    } else {
      serveStatic(app);
      log('Static files setup complete');
    }

    // 6. Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    // 7. Start server
    const PORT = 3000; // Changed to use port 3000 by default

    // Ensure port is available before starting
    await ensurePortAvailable(PORT);

    // Start the server
    await new Promise<void>((resolve, reject) => {
      if (!httpServer) {
        reject(new Error('HTTP server not initialized'));
        return;
      }

      httpServer.listen(PORT, "0.0.0.0", () => {
        log(`Server started successfully on port ${PORT}`);
        resolve();
      }).on('error', (error: NodeJS.ErrnoException) => {
        reject(error);
      });
    });

  } catch (error) {
    console.error('Server initialization error:', error);
    await cleanup();
    process.exit(1);
  }
})();