import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Track active connections for proper cleanup
const activeConnections = new Set<any>();

// Add JSON and URL-encoded parsing middleware first
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Simple request logging
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    log(`${req.method} ${req.path}`);
  }
  next();
});

// Track connections for cleanup
app.use((req, res, next) => {
  const socket = req.socket;
  if (socket) {
    activeConnections.add(socket);
    socket.once('close', () => {
      activeConnections.delete(socket);
    });
  }
  next();
});

// Register routes first
const server = registerRoutes(app);

// Main setup function
(async () => {
  try {
    // Setup Vite in development
    if (app.get("env") === "development") {
      log('Setting up Vite middleware...');
      await setupVite(app, server);
      log('Vite middleware setup complete');
    } else {
      log('Setting up static file serving...');
      serveStatic(app);
    }

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json({ message: err.message || 'Internal Server Error' });
    });

    // Cleanup function
    const cleanup = () => {
      log('Cleaning up connections...');
      activeConnections.forEach((socket) => {
        socket.destroy();
      });
      activeConnections.clear();

      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    };

    // Handle graceful shutdown
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);

    // Start server
    server.listen(5000, "0.0.0.0", () => {
      log(`Server running on port 5000`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();