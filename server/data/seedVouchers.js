// Creates the three voucher codes the product page has always advertised —
// GLOW05 (5% off, first order), BEAUTY20 (20% off from ₦25,000) and LUXE5K
// (₦5,000 off from ₦50,000) — in a database that doesn't have them yet.
// Codes that already exist are left exactly as they are, so it's safe to
// re-run, and any changes made in Admin → Vouchers are kept.
//
// Dry run by default; pass --apply to write:
//   node data/seedVouchers.js            # shows what would be created
//   node data/seedVouchers.js --apply    # creates them
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Voucher from "../models/Voucher.js";
import { ADVERTISED_VOUCHERS, describeVoucher } from "../services/vouchers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGO_URI);

const existing = new Set((await Voucher.find().select("code")).map((v) => v.code));
const missing = ADVERTISED_VOUCHERS.filter((v) => !existing.has(v.code));

for (const v of ADVERTISED_VOUCHERS) {
  const { discountLabel, conditionLabel } = describeVoucher({ minSubtotal: 0, ...v });
  const state = existing.has(v.code) ? "already exists, left unchanged" : apply ? "created" : "would be created";
  console.log(`  ${v.code.padEnd(9)} ${discountLabel.padEnd(11)} ${conditionLabel.padEnd(22)} ${state}`);
}

if (!apply) {
  console.log(`\nDry run — nothing changed. Re-run with --apply to create ${missing.length} voucher(s).`);
} else if (missing.length > 0) {
  await Voucher.insertMany(missing);
  console.log(`\nCreated ${missing.length} voucher(s).`);
}

await mongoose.disconnect();
