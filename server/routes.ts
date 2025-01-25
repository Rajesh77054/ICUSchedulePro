import express, { type Express } from "express";
import { Server } from "http";
import { type Handler } from "./types";
import { WebSocketServer } from 'ws';

export async function registerRoutes(app: Express): Promise<Server> {
  const { createServer } = await import('node:http');
  const server = createServer(app);

  // Initialize WebSocket server properly
  const wss = new WebSocketServer({ noServer: true });

  // Attach WebSocket server to HTTP server
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return server;
}