import express from "express";
import cors from "cors";
import { registerRoutes, initializeServer } from "./routes";
import { setupVite, log } from "./vite";
import { setupWebSocket } from "./websocket";

const app = express();

// Configure CORS to be more permissive in development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all replit.dev subdomains and localhost during development
    if (origin.endsWith('.replit.dev') || 
        origin.startsWith('http://localhost') || 
        origin.startsWith('http://0.0.0.0')) {
      return callback(null, true);
    }

    // In production, only allow specific origins
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'));
    }

    // In development, be more permissive
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic error logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`, 'http');
    }
  });
  next();
});

// Update port configuration to use a single port
const port = parseInt(process.env.PORT || '5000', 10);

// Function to handle graceful shutdown
function gracefulShutdown(server: any, wsInterface: any) {
  log('Received shutdown signal, closing server...', 'server');

  // First cleanup WebSocket connections
  if (wsInterface) {
    wsInterface.cleanup();
  }

  server.close(() => {
    log('Server closed', 'server');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Start server with better error handling
const startServer = async () => {
  try {
    const httpServer = await initializeServer(app);

    // Initialize WebSocket after HTTP server is created but before routes
    const wsInterface = await setupWebSocket(httpServer);

    // Register routes with WebSocket interface
    registerRoutes(app, wsInterface);

    // Setup Vite in development
    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        log(`Failed to start server: ${err.message}`, 'server');
        reject(err);
      };

      httpServer.once('error', onError);

      httpServer.listen(port, '0.0.0.0', () => {
        httpServer.removeListener('error', onError);
        log(`Server started on port ${port}`, 'server');
        resolve();
      });
    });

    // Handle graceful shutdown signals
    process.on('SIGTERM', () => gracefulShutdown(httpServer, wsInterface));
    process.on('SIGINT', () => gracefulShutdown(httpServer, wsInterface));

  } catch (error) {
    log(`Failed to start server: ${(error as Error).message}`, 'server');
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  log(`Failed to start server: ${(error as Error).message}`, 'server');
  process.exit(1);
});