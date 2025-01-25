
import express, { type Express } from "express";
import { Server } from "http";
import { type Handler } from "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add your route handlers here
  return (await import('node:http')).createServer(app);
}
