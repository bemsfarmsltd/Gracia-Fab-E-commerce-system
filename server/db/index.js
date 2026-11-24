import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

// The Supabase connection. DATABASE_URL is the pooler ("Transaction" mode,
// port 6543) string from Supabase → Connect. The pooler doesn't support
// prepared statements, hence prepare: false. Created on first use so tests
// and scripts that never touch Postgres don't need the variable.
let client;
let db;

export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client = postgres(url, { prepare: false, max: 5, ssl: "require" });
  db = drizzle(client, { schema });
  return db;
}

export async function closeDb() {
  if (client) await client.end({ timeout: 5 });
  client = undefined;
  db = undefined;
}
