import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Configure CORS to allow Replit domains
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all replit.dev subdomains
    if (origin.endsWith('.replit.dev')) return callback(null, true);

    callback(new Error('Not allowed by CORS'));
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

// Setup Vite in development
if (app.get("env") === "development") {
  setupVite(app, httpServer);
}

// Get port from environment variable or use default
const port = process.env.PORT || 5000;

// Function to handle graceful shutdown
function gracefulShutdown(server: any) {
  console.log('Received shutdown signal, closing server...');
  server.close(() => {
    console.log('Server closed');
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
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, '0.0.0.0', () => {
        console.log(`Server started on port ${port}`);
        resolve();
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Please use a different port or kill the process using this port.`);
        } else {
          console.error('Failed to start server:', err);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown(httpServer));
process.on('SIGINT', () => gracefulShutdown(httpServer));

// Start the server
startServer();