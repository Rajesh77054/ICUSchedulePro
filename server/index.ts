import express from "express";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { WebSocketServer } from 'ws';
import { log } from './vite';
import type { Server } from 'http';

const app = express();

// Security headers middleware - development friendly
app.use((req, res, next) => {
  // In development, we need to be more permissive with CSP
  if (process.env.NODE_ENV === "development") {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob:;"
    );
  } else {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob:;"
    );
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging for API routes
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

async function initializeWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    perMessageDeflate: false
  });

  wss.on('connection', (ws) => {
    log('WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        log(`Received message: ${data.type}`);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      log('Client disconnected');
    });
  });

  return wss;
}

async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "5000", 10);
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server started on port ${port}`);
    });

    // Initialize WebSocket after HTTP server is running
    const wss = await initializeWebSocket(server);
    log(`WebSocket server initialized with ${wss.clients.size} clients`);

    // Setup Vite in development - Must be before API routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, { server });
    }

    // Register API routes after Vite setup
    registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Server error:', err);
      if (res.headersSent) return;
      res.status(500).json({ message: 'Internal Server Error' });
    });

    // Catch-all handler for frontend routes - should be last
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      next();
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server...');

      // Close WebSocket server
      wss.close(() => {
        console.log('WebSocket server closed');
      });

      // Close HTTP server
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);