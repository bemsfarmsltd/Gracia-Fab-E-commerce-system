// Give (or take away) admin access to the store's dashboard.
// The person must have registered on the site first, with that email.
//
// Dry run by default; add --apply to change anything. Run from server/ with
// MONGO_URI set (server/.env, or $env:MONGO_URI in PowerShell):
//   npm run admin:grant -- --list                       # who is an admin now
//   npm run admin:grant -- someone@example.com          # what would change
//   npm run admin:grant -- someone@example.com --apply  # make them an admin
//   npm run admin:grant -- someone@example.com --revoke --apply
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const revoke = args.includes("--revoke");
const list = args.includes("--list");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI isn't set. Put it in server/.env or set $env:MONGO_URI first.");
  process.exit(1);
}
if (!list && !email) {
  console.error("Give an email address, or --list. See the top of scripts/grantAdmin.js.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const showAdmins = async () => {
  const admins = await User.find({ isAdmin: true }).select("name email").lean();
  console.log(`Admins (${admins.length}):`);
  for (const a of admins) console.log(`  ${a.email}  (${a.name})`);
};

if (list) {
  await showAdmins();
} else {
  const user = await User.findOne({ email }).select("name email isAdmin");
  if (!user) {
    console.error(`No account with ${email}. Ask them to register on the site first, then run this again.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const want = !revoke;
  if (user.isAdmin === want) {
    console.log(`${user.email} (${user.name}) is ${want ? "already an admin" : "already not an admin"}. Nothing to do.`);
  } else if (!apply) {
    console.log(`Dry run: would ${want ? "make" : "remove"} ${user.email} (${user.name}) ${want ? "an admin" : "as admin"}. Re-run with --apply.`);
  } else {
    if (!want && (await User.countDocuments({ isAdmin: true })) <= 1) {
      console.error("Refusing: this is the last admin. Make someone else an admin first.");
      await mongoose.disconnect();
      process.exit(1);
    }
    user.isAdmin = want;
    await user.save();
    console.log(`Done: ${user.email} (${user.name}) is ${want ? "now an admin" : "no longer an admin"}.`);
  }
  await showAdmins();
}

await mongoose.disconnect();
