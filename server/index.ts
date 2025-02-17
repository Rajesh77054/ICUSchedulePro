import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

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
  try {
    // Setup auth before registering routes
    setupAuth(app);
    const server = registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = process.env.PORT || 3000;
    return app.listen(port, '0.0.0.0', () => {
      log(`Server started on port ${port}`);
    });
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