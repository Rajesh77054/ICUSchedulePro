import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";
import { sql } from 'drizzle-orm';
import { serviceRegistry } from '../server/services/registry';

interface DBConnectionConfig {
  maxRetries?: number;
  retryInterval?: number; // in milliseconds
}

class DatabaseConnection {
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

  async initialize(config: DBConnectionConfig = {}): Promise<void> {
    const success = await this.connect(config);
    if (!success) {
      throw new Error('Failed to initialize database connection');
    }
  }

  async connect(config: DBConnectionConfig = {}): Promise<boolean> {
    const { maxRetries = 3, retryInterval = 5000 } = config;

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    while (this.connectionAttempts < maxRetries) {
      try {
        this._db = drizzle({
          connection: process.env.DATABASE_URL,
          schema,
          ws: ws,
        });

        // Verify connection by running a simple query
        await this._db.execute(sql`SELECT 1`);
        console.log('Database connection established successfully');
        return true;
      } catch (error) {
        this.connectionAttempts++;
        console.error(`Database connection attempt ${this.connectionAttempts} failed:`, error);

        if (this.connectionAttempts < maxRetries) {
          console.log(`Retrying in ${retryInterval / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }
    }

    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
  }

  get db(): ReturnType<typeof drizzle> {
    if (!this._db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this._db;
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
}

const dbInstance = DatabaseConnection.getInstance();

// Register database service with the registry
serviceRegistry.register('database', dbInstance, []);

// Export a getter function for the database instance
export const getDb = () => dbInstance.db;
export const db = getDb;
export { DatabaseConnection };