#!/usr/bin/env node
/* eslint-disable no-console */
// Copies the whole store from MongoDB (MONGO_URI) into Supabase Postgres
// (DATABASE_URL), keeping every id, then checks the figures match.
// See docs/SUPABASE_MIGRATION.md.
//
//   node scripts/copyMongoToSupabase.js --dry-run
//       Reads MongoDB and reports what would be copied and any problems.
//       Writes nothing anywhere. Safe to run against production.
//
//   node scripts/copyMongoToSupabase.js
//       Creates the tables (migrations) and copies. Refuses if the target
//       already has data.
//
//   node scripts/copyMongoToSupabase.js --replace
//       Empties the target first. Rehearsal projects only: you must also set
//       COPY_TARGET_IS_REHEARSAL=yes.
//
// MongoDB is only ever read, never changed.
import "dotenv/config";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { transformAll, summarise } from "../db/copy/transform.js";
import { loadRows, countRows, wipe, summariseDb, compare } from "../db/copy/load.js";
import { getDb, closeDb } from "../db/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");

const COLLECTIONS = {
  users: "users", products: "products", reviews: "reviews", orders: "orders",
  vouchers: "vouchers", bookings: "bookings", customerNotes: "customernotes",
  contacts: "contacts", subscribers: "subscribers",
};

// Host only, never the password.
const hostOf = (url) => {
  try { return new URL(url).host; } catch { return "(unreadable address)"; }
};

async function readMongo() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Reading MongoDB at ${hostOf(process.env.MONGO_URI)} (read-only)`);
  const source = {};
  for (const [key, collection] of Object.entries(COLLECTIONS)) {
    source[key] = await mongoose.connection.db.collection(collection).find({}).toArray();
  }
  await mongoose.disconnect();
  return source;
}

function printList(title, list, limit = 30) {
  if (!list.length) return;
  console.log(`\n${title} (${list.length}):`);
  for (const line of list.slice(0, limit)) console.log(`  - ${line}`);
  if (list.length > limit) console.log(`  … and ${list.length - limit} more`);
}

async function main() {
  const source = await readMongo();
  const { rows, problems, warnings } = transformAll(source);
  const expected = summarise(rows);

  console.log("\nWhat will be copied:");
  console.table(expected);
  printList("Warnings (copied with the change shown)", warnings);
  printList("Problems (must be fixed in MongoDB before copying)", problems);

  if (problems.length) {
    console.log("\nStopped: nothing was written.");
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log("\nDry run: nothing was written.");
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  console.log(`\nWriting to Postgres at ${hostOf(process.env.DATABASE_URL)}`);
  const db = getDb();
  try {
    await migrate(db, { migrationsFolder: path.join(here, "../db/migrations") });

    const existing = await countRows(db);
    const hasData = Object.values(existing).some((n) => n > 0);
    if (hasData && !replace) {
      console.log("Stopped: the target already has data. Use --replace on a rehearsal project.");
      process.exitCode = 1;
      return;
    }
    if (hasData) {
      if (process.env.COPY_TARGET_IS_REHEARSAL !== "yes") {
        console.log("Stopped: --replace empties the target. Set COPY_TARGET_IS_REHEARSAL=yes to confirm it's a rehearsal project.");
        process.exitCode = 1;
        return;
      }
      console.log("Emptying the rehearsal target…");
      await wipe(db);
    }

    const started = Date.now();
    await loadRows(db, rows);
    const actual = await summariseDb(db);
    const mismatches = compare(expected, actual);
    console.log(`\nCopied in ${((Date.now() - started) / 1000).toFixed(1)}s. Read back from Postgres:`);
    console.table(actual);
    if (mismatches.length) {
      printList("MISMATCHES: don't switch over", mismatches);
      process.exitCode = 1;
    } else {
      console.log("\nAll figures match.");
    }
  } finally {
    await closeDb();
  }
}

main().catch(async (err) => {
  console.error(`\nCopy failed: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  await closeDb().catch(() => {});
  process.exit(1);
});
