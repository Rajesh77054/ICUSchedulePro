
import express, { type Express } from "express";
import { Server } from "http";
import { type Handler } from "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  const { createServer } = await import('node:http');
  const server = createServer(app);
  
  // Ensure server is only created once
  if (!global.httpServer) {
    global.httpServer = server;
  }
  
  return global.httpServer;
}
