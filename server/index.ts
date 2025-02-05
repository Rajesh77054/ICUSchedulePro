import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";

const app = express();

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
  setupVite(app);
}

// Start server
const port = 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server started on port ${port}`);
});