import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { createServer, type Server } from "http";

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

(async () => {
  let httpServer: Server | undefined;

  const cleanup = async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer?.close(() => resolve());
      });
    }
  };

  try {
    // 1. Verify database connection first
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection verified');
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error('Failed to connect to database');
    }

    // 2. Setup authentication if available
    try {
      await setupAuth(app);
      log('Authentication setup complete');
    } catch (error) {
      console.error('Auth setup warning:', error);
      log('Continuing without authentication...');
    }

    // 3. Create HTTP server first
    httpServer = createServer(app);

    // 4. Setup routes and WebSocket with the HTTP server
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
    const PORT = 5000;

    // Attempt to start the server with retries
    const startServer = async (retries = 3, delay = 1000): Promise<void> => {
      try {
        await new Promise<void>((resolve, reject) => {
          if (!httpServer) {
            reject(new Error('HTTP server not initialized'));
            return;
          }

          httpServer.listen(PORT, "0.0.0.0", () => {
            log(`Server started on port ${PORT}`);
            resolve();
          }).on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`Port ${PORT} is already in use`));
            } else {
              reject(error);
            }
          });
        });
      } catch (error) {
        if (retries > 0 && error instanceof Error && error.message.includes('EADDRINUSE')) {
          log(`Port ${PORT} is busy, retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return startServer(retries - 1, delay * 2);
        }
        throw error;
      }
    };

    // Handle process termination signals
    process.on('SIGTERM', async () => {
      log('Received SIGTERM. Starting graceful shutdown...');
      await cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      log('Received SIGINT. Starting graceful shutdown...');
      await cleanup();
      process.exit(0);
    });

    await startServer();

  } catch (error) {
    console.error('Server initialization error:', error);
    await cleanup();
    process.exit(1);
  }
})();