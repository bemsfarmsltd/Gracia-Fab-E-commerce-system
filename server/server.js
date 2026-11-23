import "dotenv/config";
import dns from "dns";
import { initMonitoring, captureError } from "./utils/monitoring.js";
import connectDB from "./config/db.js";
import { startWorkers } from "./queues/workers.js";
import cron from "node-cron";
import { sendMarketingEmails } from "./controllers/marketingController.js";
import { expireUnpaidOrders } from "./services/orderCleanup.js";
import { recalculateAllRatings } from "./services/ratings.js";
import app from "./app.js";
import logger from "./utils/logger.js";

// Render's outbound network doesn't route IPv6, but Node's default DNS
// order can still hand back an AAAA record first (e.g. for Gmail's SMTP
// host) — that connection then hangs until it times out instead of
// falling back to IPv4. Preferring IPv4 results avoids that for every
// outbound connection this process makes (Mongo, SMTP, any future API call).
dns.setDefaultResultOrder("ipv4first");

// Crash alerts (only when SENTRY_DSN is set). Before anything else starts.
await initMonitoring();

const dbConnected = await connectDB();

// Ratings come only from real reviews: correct any product whose stored
// numbers don't match (e.g. values typed into the catalogue). Safe to repeat.
if (dbConnected) {
  recalculateAllRatings()
    .then((fixed) => fixed && logger.info({ fixed }, "Product ratings recalculated from real reviews"))
    .catch((err) => logger.error({ err }, "Rating recalculation failed"));
}
startWorkers();

cron.schedule("0 10 * * *", async () => {
  logger.info("Running daily marketing email job");
  try {
    await sendMarketingEmails();
  } catch (err) {
    logger.error({ err }, "Daily marketing email job failed");
    captureError(err, { job: "marketing-emails" });
  }
});

// Hourly rather than daily: Render's free plan sleeps when idle, so a single
// daily run could be missed. Each run only touches orders past 48 hours.
cron.schedule("15 * * * *", async () => {
  try {
    await expireUnpaidOrders();
  } catch (err) {
    logger.error({ err }, "Unpaid-order cleanup failed");
    captureError(err, { job: "unpaid-order-cleanup" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server running");
});
