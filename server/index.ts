import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
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

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  const status = err instanceof Error ? 500 : 400;
  const message = err instanceof Error ? err.message : "Bad Request";

  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

// Server initialization
(async () => {
  try {
    // Setup authentication
    await setupAuth(app);

    // Create server
    const server = registerRoutes(app);

    // Setup Vite or static files
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server with port retry logic
    const startServer = async () => {
      for (let port = 5000; port < 5010; port++) {
        try {
          await new Promise<void>((resolve, reject) => {
            // Ensure cleanup of any existing connections
            if (server.listening) {
              server.close();
            }
            server.removeAllListeners();

            const onError = (err: NodeJS.ErrnoException) => {
              server.removeListener('error', onError);
              if (err.code === 'EADDRINUSE') {
                log(`Port ${port} is in use, trying ${port + 1}`);
                resolve(); // Continue to next port
              } else {
                reject(err);
              }
            };

            const onListening = () => {
              server.removeListener('error', onError);
              log(`Server started successfully on port ${port}`);
              resolve();
            };

            server.once('error', onError);
            server.once('listening', onListening);

            server.listen(port, "0.0.0.0");
          });

          // If we get here, server started successfully
          return;
        } catch (err) {
          console.error(`Failed to start server on port ${port}:`, err);
          if (port === 5009) {
            throw new Error('Failed to find available port after all retries');
          }
          // Continue to next port
        }
      }
      throw new Error('Failed to start server after trying all ports');
    };

    await startServer();

  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
})();