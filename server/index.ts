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

      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
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

    // Initialize OpenAI handler
    const { OpenAIChatHandler } = await import('./openai-handler');
    const openaiHandler = new OpenAIChatHandler();
    app.set('openaiHandler', openaiHandler);

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

    // Try ports starting from 5000
    const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
    
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', (err: any) => {
          console.error(`Failed to start server on port ${port}:`, err);
          reject(err);
        });

        server.listen(port, "0.0.0.0", () => {
          log(`Server started successfully on port ${port}`);
          resolve();
        });
      });
      } catch (err: any) {
        console.error('Server startup error:', err);
        process.exit(1);
      } finally {
        if (!server.listening) {
          console.error('Failed to start server');
          process.exit(1);
        }
      }
    }
  } catch (error: any) {
    console.error('Server initialization error:', error);
    console.error("Detailed error stack:", error.stack); //Added for better debugging
    process.exit(1);
  }
})();