import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
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

// Global error handler
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  if (res.headersSent) {
    return _next(err);
  }

  const status = err instanceof Error ? 500 : 400;
  const message = err instanceof Error ? err.message : "Bad Request";

  res.status(status).json({ 
    error: true,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

// Structured server initialization
async function startServer() {
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

    // 3. Create HTTP server and register routes with error handling
    const { server, cleanup: wsCleanup } = await registerRoutes(app);
    log('Routes registered successfully');

    // 4. Setup development or production mode
    if (app.get("env") === "development") {
      try {
        await setupVite(app, server);
        log('Vite development server setup complete');
      } catch (error) {
        console.error('Vite setup error:', error);
        throw new Error('Failed to setup Vite development server');
      }
    } else {
      try {
        serveStatic(app);
        log('Static files setup complete');
      } catch (error) {
        console.error('Static files setup error:', error);
        throw new Error('Failed to setup static files');
      }
    }

    // Add error handler after all middleware
    app.use(errorHandler);

    // 5. Start the server on the designated port
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      log(`Received ${signal}. Starting graceful shutdown...`);
      try {
        if (wsCleanup) {
          await wsCleanup();
        }
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Server initialization error:', error);
    throw error;
  }
}

// Start the server with global error handling
startServer().catch(error => {
  console.error('Fatal server error:', error);
  process.exit(1);
});