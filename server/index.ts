import express from "express";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { initializeServer } from './websocket';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic error logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Register routes
registerRoutes(app);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Initialize server with WebSocket support first
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "5000", 10);
    const server = await initializeServer(app);

    // Setup Vite in development after WebSocket is initialized
    if (app.get("env") === "development") {
      await setupVite(app, { server });
    }

    server.listen(port, '0.0.0.0', () => {
      console.log(`Server started on port ${port}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please free up the port or use a different one.`);
        process.exit(1);
      } else {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);