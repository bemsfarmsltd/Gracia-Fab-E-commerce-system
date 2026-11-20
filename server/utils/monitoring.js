import logger from "./logger.js";

// Crash alerts through Sentry. Off unless SENTRY_DSN is set (Render env):
// without it @sentry/node isn't even loaded and captureError does nothing.
//
// Privacy: events are scrubbed before they leave the server. No request
// bodies (passwords, login codes, addresses), cookies, auth headers, IP
// addresses or email addresses are sent.

let sentry = null;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
// Secret-looking parameters in links or messages: ?t=…, &code=…, "reference=…".
const SECRET_QUERY = /((?:^|[?&\s])(?:t|token|code|otp|access_token|reference|paymentReference)=)[^&#\s]*/gi;
const redact = (s) =>
  typeof s === "string" ? s.replace(EMAIL, "[email]").replace(BEARER, "Bearer [token]").replace(SECRET_QUERY, "$1[redacted]") : s;

export function scrubEvent(event) {
  if (!event) return event;
  delete event.user;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-forwarded-for|x-real-ip|monnify-signature)$/i.test(h)) delete event.request.headers[h];
      }
    }
    if (event.request.url) event.request.url = event.request.url.replace(SECRET_QUERY, "$1[redacted]");
    if (event.request.query_string) event.request.query_string = "[redacted]";
  }
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values || []) ex.value = redact(ex.value);
  if (event.extra) for (const k of Object.keys(event.extra)) event.extra[k] = redact(event.extra[k]);
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({ ...b, message: redact(b.message), data: undefined }));
  }
  return event;
}

export async function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      // Render sets this to the deployed commit.
      release: process.env.RENDER_GIT_COMMIT || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0, // errors only; keeps the free quota for crashes
      beforeSend: scrubEvent,
    });
    sentry = Sentry;
    logger.info("Error monitoring is on (Sentry)");
    return true;
  } catch (err) {
    logger.warn({ err }, "Error monitoring could not start; continuing without it");
    return false;
  }
}

// Report an error (no-op when monitoring is off). `context` becomes tags
// for short strings and extra data otherwise.
export function captureError(error, context = {}) {
  if (!sentry || !error) return;
  try {
    sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) {
        if (typeof v === "string" && v.length <= 100) scope.setTag(k, v);
        else scope.setExtra(k, v);
      }
      sentry.captureException(error);
    });
  } catch {
    // Monitoring must never break the request that failed.
  }
}

export const isMonitoringOn = () => Boolean(sentry);

// For tests only.
export function __setSentryForTests(fake) {
  sentry = fake;
}
