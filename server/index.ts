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
    let server;
    try {
      server = await registerRoutes(app);
      log('Routes registered successfully');
    } catch (error) {
      console.error('Route registration error:', error);
      throw new Error('Failed to register routes');
    }

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

    // 5. Start server with enhanced error handling
    const PORT = parseInt(process.env.PORT || "5000", 10);
    const HOST = "0.0.0.0";

    return new Promise<void>((resolve, reject) => {
      server!.listen(PORT, HOST)
        .once('listening', () => {
          log(`Server started successfully on port ${PORT}`);
          resolve();
        })
        .once('error', (error: NodeJS.ErrnoException) => {
          console.error('Server startup error:', error);
          reject(error);
        });
    });

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