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

// Port retry configuration
const PORT_RETRY = {
  START: 5000,
  MAX_RETRIES: 3,
  INCREMENT: 1
};

// Function to try starting server on a port
async function tryStartServer(port: number, host: string, server: any): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (error: any) => {
      if (error.code === 'EADDRINUSE') {
        server.removeListener('error', onError);
        resolve(false);
      }
    };

    server.once('error', onError);

    server.listen(port, host, () => {
      server.removeListener('error', onError);
      log(`Server started successfully on port ${port}`);
      resolve(true);
    });
  });
}

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

    // 5. Start server with port retry logic
    let currentPort = PORT_RETRY.START;
    let retryCount = 0;
    let serverStarted = false;

    const HOST = "0.0.0.0";

    while (!serverStarted && retryCount < PORT_RETRY.MAX_RETRIES) {
      log(`Attempting to start server on port ${currentPort}...`);

      // Try to start the server
      serverStarted = await tryStartServer(currentPort, HOST, server);

      if (!serverStarted) {
        retryCount++;
        if (retryCount < PORT_RETRY.MAX_RETRIES) {
          currentPort += PORT_RETRY.INCREMENT;
          log(`Port ${currentPort - PORT_RETRY.INCREMENT} in use, trying port ${currentPort}...`);
        } else {
          throw new Error(`Failed to find available port after ${PORT_RETRY.MAX_RETRIES} attempts`);
        }
      }
    }

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      log(`Received ${signal}. Starting graceful shutdown...`);
      try {
        if (wsCleanup) {
          await wsCleanup();
        }
        if (server?.listening) {
          await new Promise<void>((resolve, reject) => {
            server.close((err?: Error) => {
              if (err) {
                console.error('Error closing server:', err);
                reject(err);
                return;
              }
              resolve();
            });
          });
        }
        log('Server shutdown complete');
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