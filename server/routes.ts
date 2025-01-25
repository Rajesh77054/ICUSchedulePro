
import express, { type Express } from "express";
import { Server } from "http";
import { type Handler } from "./types";

export function registerRoutes(app: Express): Server {
  // Add your route handlers here
  
  const server = app.listen(3000, "0.0.0.0", () => {
    console.log("Server is running on port 3000");
  });
  
  return server;
}
