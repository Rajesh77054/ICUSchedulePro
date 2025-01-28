import express from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple request logging
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    log(`${req.method} ${req.path}`);
  }
  next();
});

// Register routes first
const server = registerRoutes(app);


// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Start server
const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  log(`Server running on port ${PORT}`);
});