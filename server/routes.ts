// routes.ts
import express, { Express } from 'express';

export function registerRoutes(app: Express) {
  // ... existing route registration logic ...
  return app; //Added this line to return the server object
}

//other files...