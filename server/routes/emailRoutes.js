import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { isValidUnsubscribeToken } from "../utils/unsubscribe.js";

const router = express.Router();

const page = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Gracia Fab</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#FBF3E7;color:#241310;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;">
<main style="max-width:440px;text-align:center;background:#fff;border-radius:16px;padding:32px;box-shadow:0 6px 28px rgba(122,36,50,0.15);">
<h1 style="font-family:Georgia,serif;color:#7A2432;margin:0 0 12px;">${title}</h1>
<p style="color:#5f4038;line-height:1.6;margin:0 0 20px;">${message}</p>
<a href="https://gracia-fab.vercel.app" style="display:inline-block;background:#7A2432;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">Back to Gracia Fab</a>
</main></body></html>`;

async function unsubscribe(req) {
  const { u, t } = req.query;
  if (!mongoose.isValidObjectId(u) || !isValidUnsubscribeToken(u, t)) return "invalid";
  const result = await User.updateOne({ _id: u }, { $set: { "emailPreferences.marketing": false } });
  if (result.matchedCount === 0) return "invalid";
  logger.info({ userId: u }, "Unsubscribed from marketing emails");
  return "ok";
}

// @desc   Unsubscribe link in marketing emails (no login needed; signed link)
// @route  GET /api/email/unsubscribe?u=<userId>&t=<signature>
router.get("/unsubscribe", async (req, res) => {
  try {
    if ((await unsubscribe(req)) !== "ok") {
      return res
        .status(400)
        .send(page("Link not valid", "This unsubscribe link isn't valid. You can turn marketing emails off any time under Account → Marketing preferences."));
    }
    res.send(page("You're unsubscribed", "You won't get any more marketing emails from Gracia Fab. Order and account emails (receipts, delivery updates) will still arrive. You can switch marketing emails back on under Account → Marketing preferences."));
  } catch (error) {
    logger.error({ err: error }, "unsubscribe error");
    res.status(500).send(page("Something went wrong", "Please try the link again in a moment."));
  }
});

// @desc   One-click unsubscribe from Gmail/Outlook's own button (RFC 8058)
// @route  POST /api/email/unsubscribe?u=<userId>&t=<signature>
router.post("/unsubscribe", async (req, res) => {
  try {
    const result = await unsubscribe(req);
    res.status(result === "ok" ? 200 : 400).send(result === "ok" ? "Unsubscribed" : "Invalid link");
  } catch (error) {
    logger.error({ err: error }, "one-click unsubscribe error");
    res.status(500).send("Error");
  }
});

export default router;
