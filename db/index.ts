import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { sql } from 'drizzle-orm';
import { serviceOrchestrator } from '../server/services/orchestration';
import type { ServiceInstance } from '../server/services/orchestration';

interface DBConnectionConfig {
  maxRetries?: number;
  retryInterval?: number;
  timeout?: number;
}

class DatabaseConnection implements ServiceInstance {
  private static instance: DatabaseConnection;
  private _db: ReturnType<typeof drizzle> | null = null;
  private connectionAttempts = 0;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    this._db = drizzle({
      connection: process.env.DATABASE_URL,
      schema,
      ws: ws,
    });

    // Verify connection
    await this._db.execute(sql`SELECT 1`);
  }

  async start(): Promise<void> {
    // Additional startup tasks if needed
    return;
  }

  async stop(): Promise<void> {
    this._db = null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this._db) return false;
      await this._db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  get db(): ReturnType<typeof drizzle> {
    if (!this._db) {
      throw new Error('Database not initialized. Wait for service initialization.');
    }
    return this._db;
  }
}

// Create singleton instance
const dbInstance = DatabaseConnection.getInstance();

// Register with orchestrator
serviceOrchestrator.register(dbInstance, {
  name: 'database',
  dependencies: [],
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 30000,
});

// Exports
export type { DatabaseConnection };
export const getDb = () => dbInstance.db;
export const db = getDb();