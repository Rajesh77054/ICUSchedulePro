import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const config = {
  connection: process.env.DATABASE_URL,
  schema,
  ws: ws,
  transformValues: {
    out: {
      number: (value) => Number(value),
      bigint: (value) => Number(value)
    }
  }
};

export const db = drizzle(config);
