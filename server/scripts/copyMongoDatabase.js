#!/usr/bin/env node
/* eslint-disable no-console */
// Copies the store's MongoDB database (MONGO_URI) into the company's own
// MongoDB Atlas account (NEW_MONGO_URI), then checks every collection and the
// business totals match. The current database is only read, never changed.
//
//   node scripts/copyMongoDatabase.js --dry-run   what would be copied; writes nothing
//   node scripts/copyMongoDatabase.js             copy (refuses if the new database has data)
//   node scripts/copyMongoDatabase.js --replace   overwrite the new database (needs COPY_REPLACE_TARGET=yes)
//   node scripts/copyMongoDatabase.js --verify    only compare the two databases again
//
// After a successful copy: set MONGO_URI on Hostinger to the new string,
// restart, check /health. Keep the old database untouched for 30 days.
import "dotenv/config";
import mongoose from "mongoose";
import { copyDatabase, verifyCopy, listCollections, fingerprint } from "./lib/copyMongo.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");
const verifyOnly = args.has("--verify");

// Host and database name only, never the password.
function describe(url) {
  const u = new URL(url);
  return { host: u.host, dbName: decodeURIComponent(u.pathname.replace(/^\//, "")) };
}

async function main() {
  const { MONGO_URI, NEW_MONGO_URI } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI (the current database) is not set in server/.env");
  if (!dryRun && !NEW_MONGO_URI) throw new Error("NEW_MONGO_URI (the company database) is not set in server/.env");

  const from = describe(MONGO_URI);
  const source = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log(`Current database: ${from.host} / ${source.db.databaseName} (read only)`);

  let target;
  if (NEW_MONGO_URI) {
    const to = describe(NEW_MONGO_URI);
    if (!to.dbName) {
      throw new Error("NEW_MONGO_URI has no database name. Add it after .mongodb.net/, e.g. .mongodb.net/gracia-fab?retryWrites=true");
    }
    if (to.host === from.host && to.dbName === source.db.databaseName) {
      throw new Error("NEW_MONGO_URI points at the current database. Nothing was copied.");
    }
    target = await mongoose.createConnection(NEW_MONGO_URI).asPromise();
    console.log(`New database:     ${to.host} / ${target.db.databaseName}`);
  }

  try {
    if (dryRun) {
      const rows = [];
      for (const name of await listCollections(source.db)) {
        rows.push({ collection: name, documents: (await fingerprint(source.db, name)).count });
      }
      console.table(rows);
      console.log("Dry run: nothing was written.");
      return;
    }

    if (!verifyOnly) {
      if (replace && process.env.COPY_REPLACE_TARGET !== "yes") {
        throw new Error("--replace overwrites the new database. Set COPY_REPLACE_TARGET=yes to confirm.");
      }
      const started = Date.now();
      await copyDatabase(source.db, target.db, { replace, log: (line) => console.log(`  copied ${line}`) });
      console.log(`Copied in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    }

    const { differences, report, totals } = await verifyCopy(source.db, target.db);
    console.table(report);
    console.log("Totals:", totals);
    if (differences.length) {
      console.log("\nDIFFERENCES: don't switch over.");
      for (const d of differences) console.log(`  - ${d}`);
      process.exitCode = 1;
    } else {
      console.log("\nEverything matches. Next: set MONGO_URI on Hostinger to the new string, restart, check /health.");
    }
  } finally {
    await source.close();
    if (target) await target.close();
  }
}

main().catch((err) => {
  console.error(`\nStopped: ${err.message}`);
  process.exit(1);
});
