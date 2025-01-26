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

// Enhanced error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  const status = err instanceof Error ? 500 : 400;
  const message = err instanceof Error ? err.message : "Bad Request";

  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

// Structured server initialization
async function startServer() {
  try {
    // 1. Verify database connection first
    await db.execute(sql`SELECT 1`);
    log('Database connection verified');

    // 2. Setup authentication
    await setupAuth(app);
    log('Authentication setup complete');

    // 3. Create HTTP server and register routes
    const server = await registerRoutes(app);
    log('Routes registered');

    // 4. Setup development or production mode
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log('Vite development server setup complete');
    } else {
      serveStatic(app);
      log('Static files setup complete');
    }

    // 5. Start server with enhanced error handling
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
    });

  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
}

// Start the server with global error handling
startServer().catch(error => {
  console.error('Fatal server error:', error);
  process.exit(1);
});