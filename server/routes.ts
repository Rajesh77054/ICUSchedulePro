
import express, { type Express } from "express";
import { Server } from "http";
import { type Handler } from "./types";

export function registerRoutes(app: Express): Server {
  // Add your route handlers here
  return require('http').createServer(app);
}
