// One-off: mark never-counted products as out of stock in an existing
// database. Two cases:
//
//   1. Products seeded before the stock default changed to 0 got an invented
//      stock of 50. Those whose catalog entry (data/products.js) has no count
//      AND whose database stock is still exactly 50 (untouched since seeding)
//      are set to 0. Any other value an admin entered is left alone.
//   2. Older products with no stock field at all are set to 0, so every
//      product has an explicit count. (The shop showed them as available
//      while checkout refused them.)
//
// Dry run by default; pass --apply to write:
//   npm run stock:zero-uncounted            # shows what would change
//   npm run stock:zero-uncounted -- --apply # makes the change
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import products from "./products.js";
import Product from "../models/Product.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const OLD_DEFAULT = 50;
const apply = process.argv.includes("--apply");

const uncountedNames = products
  .filter((p) => p.stock === undefined || p.stock === null)
  .map((p) => p.name);

await mongoose.connect(process.env.MONGO_URI);

const targets = await Product.find({
  $or: [
    { name: { $in: uncountedNames }, stock: OLD_DEFAULT },
    { stock: { $exists: false } },
    { stock: null },
  ],
}).select("name stock").lean(); // lean: report what is stored, not schema defaults

const invented = targets.filter((p) => p.stock === OLD_DEFAULT).length;
console.log(
  `${targets.length} products to set to 0: ${invented} still on the old default of ${OLD_DEFAULT}, ` +
    `${targets.length - invented} with no stock value at all.`,
);
for (const p of targets) console.log(`  - ${p.name}  (now: ${p.stock ?? "no value"})`);

if (!apply) {
  console.log("\nDry run — nothing changed. Re-run with --apply to set these to 0.");
} else if (targets.length > 0) {
  const result = await Product.updateMany(
    { _id: { $in: targets.map((p) => p._id) } },
    { $set: { stock: 0, isInStock: false } },
  );
  console.log(`\nSet ${result.modifiedCount} products to 0 (out of stock).`);
}

await mongoose.disconnect();
