import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(async (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  let originalResJson = res.json;

  try {
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (path.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine);
      }
    });

    await next();
  } catch (error) {
    console.error('Middleware error:', error);
    next(error);
  } finally {
    if (path.startsWith('/api')) {
      const duration = Date.now() - start;
      console.log(`Request to ${path} completed in ${duration}ms`);
      // Clear any references
      capturedJsonResponse = undefined;
    }
  }
});

(async () => {
  let server;
  try {
    // Setup auth before registering routes
    await setupAuth(app);

    // Initialize OpenAI handler
    const { OpenAIChatHandler } = await import('./openai-handler');
    const openaiHandler = new OpenAIChatHandler();
    app.set('openaiHandler', openaiHandler);

    server = await registerRoutes(app);

    app.use(async (err: any, _req: Request, res: Response, _next: NextFunction) => {
      try {
        console.error('Error:', err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      } catch (finalError) {
        console.error('Error in error handler:', finalError);
        res.status(500).json({ message: "Critical server error" });
      }
    });

    if (app.get("env") === "development") {
      try {
        await setupVite(app, server);
      } catch (error) {
        console.error('Vite setup error:', error);
      }
    } else {
      serveStatic(app);
    }

    // Try ports starting from 5000
    let port = 5000;
    const maxRetries = 10;
    let server_started = false;

    for (let i = 0; i < maxRetries && !server_started; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const cleanupAndRetry = (err?: Error) => {
            server.removeAllListeners();
            if (server.listening) {
              server.close(() => {
                if (err) reject(err);
                else resolve();
              });
            } else {
              if (err) reject(err);
              else resolve();
            }
          };

          server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
              log(`Port ${port} is in use, trying ${port + 1}`);
              port++;
              cleanupAndRetry(new Error('Port in use'));
            } else {
              console.error('Server error:', err);
              cleanupAndRetry(err);
            }
          });

          server.listen(port, "0.0.0.0", () => {
            log(`Server started successfully on port ${port}`);
            server_started = true;
            resolve();
          });
        });
      } catch (err: any) {
        if (i === maxRetries - 1) {
          console.error('Failed to find an available port after', maxRetries, 'attempts');
          process.exit(1);
        }
        if (err.message !== 'Port in use') {
          throw err;
        }
      }
    }
  } catch (error: any) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
})();

app.put('/api/shifts/:id', async (req, res) => {
  const shiftId = parseInt(req.params.id);
  const { startDate, endDate } = req.body;

  try {
    const result = await db.update(shifts)
      .set({ startDate, endDate, updatedAt: new Date() })
      .where(eq(shifts.id, shiftId))
      .returning();
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating shift:", error);
    res.status(500).json({ message: "Failed to update shift" });
  }
});