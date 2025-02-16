import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

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

// Register routes
registerRoutes(app);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Setup Vite in development
if (app.get("env") === "development") {
  setupVite(app, httpServer);
}

// Update port configuration to prioritize Replit's expected port
const port = parseInt(process.env.REPLIT_PORT || process.env.PORT || '5000', 10);
const maxRetries = 5;
const portRange = Array.from({ length: maxRetries }, (_, i) => port + i);

// Function to handle graceful shutdown
function gracefulShutdown(server: any) {
  log('Received shutdown signal, closing server...', 'server');
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

// Start server with better error handling and port retry logic
const startServer = async () => {
  for (const currentPort of portRange) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: any) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${currentPort} is in use, trying next port...`, 'server');
            reject(err);
          } else {
            log(`Failed to start server: ${err.message}`, 'server');
            reject(err);
          }
        };

        httpServer.once('error', onError);

        httpServer.listen(currentPort, '0.0.0.0', () => {
          httpServer.removeListener('error', onError);
          log(`Server started on port ${currentPort}`, 'server');
          // Store the actual port being used
          (global as any).SERVER_PORT = currentPort;
          resolve();
        });
      });
      // If we get here, the server started successfully
      break;
    } catch (error) {
      if (currentPort === portRange[portRange.length - 1]) {
        log(`Failed to find an available port after ${maxRetries} attempts`, 'server');
        process.exit(1);
      }
      // Continue to next attempt with incremented port
      continue;
    }
  }
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown(httpServer));
process.on('SIGINT', () => gracefulShutdown(httpServer));

// Start the server
startServer().catch(error => {
  log(`Failed to start server: ${error.message}`, 'server');
  process.exit(1);
});