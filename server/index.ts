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

let server: any;
let cleanup: (() => Promise<void>) | undefined;

// Graceful shutdown handler
async function shutdownGracefully(signal: string) {
  log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    if (cleanup) {
      await cleanup();
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
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

// Function to try binding to a port
async function tryBindPort(httpServer: any, port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (e: NodeJS.ErrnoException) => {
      httpServer.removeListener('error', onError);
      if (e.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        console.error(`Failed to bind to port ${port}:`, e);
        resolve(false);
      }
    };

    httpServer.once('error', onError);

    httpServer.listen(port, host)
      .once('listening', () => {
        httpServer.removeListener('error', onError);
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

    // 5. Start server with enhanced error handling and port retry logic
    const BASE_PORT = parseInt(process.env.PORT || "5000", 10);
    const MAX_PORT_ATTEMPTS = 10;
    const HOST = "0.0.0.0";

    // Try ports sequentially until we find an available one
    for (let portOffset = 0; portOffset < MAX_PORT_ATTEMPTS; portOffset++) {
      const port = BASE_PORT + portOffset;

      // Close any existing connections
      if (server.listening) {
        await new Promise<void>((resolve) => server.close(resolve));
      }

      const bound = await tryBindPort(server, port, HOST);
      if (bound) {
        log(`Server started successfully on port ${port}`);
        return;
      }

      if (portOffset === 0) {
        log(`Port ${port} is in use, trying alternative ports...`);
      }
    }

    throw new Error(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts`);

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