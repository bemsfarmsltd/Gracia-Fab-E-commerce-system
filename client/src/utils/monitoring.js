// Crash alerts through Sentry. Off unless VITE_SENTRY_DSN is set (Vercel env):
// without it the Sentry code is never downloaded.
//
// Privacy: no IP addresses, cookies, email addresses or secret link
// parameters (unsubscribe tokens, payment references) are sent.

let sentry = null;
const pending = [];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Secret-looking parameters in links or messages: ?t=…, &code=…, "reference=…".
const SECRET_QUERY = /((?:^|[?&\s])(?:t|token|code|otp|access_token|reference|paymentReference)=)[^&#\s]*/gi;
const redact = (s) => (typeof s === "string" ? s.replace(EMAIL, "[email]").replace(SECRET_QUERY, "$1[redacted]") : s);

export function scrubEvent(event) {
  if (!event) return event;
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    if (event.request.url) event.request.url = redact(event.request.url);
    if (event.request.headers) delete event.request.headers.Referer;
    if (event.request.query_string) event.request.query_string = "[redacted]";
  }
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values || []) ex.value = redact(ex.value);
  return event;
}

export function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb;
  // Console output can contain anything; keep it out.
  if (crumb.category === "console") return null;
  const data = crumb.data ? { ...crumb.data } : undefined;
  if (data?.url) data.url = redact(data.url);
  if (data?.to) data.to = redact(data.to);
  if (data?.from) data.from = redact(data.from);
  return { ...crumb, message: redact(crumb.message), data };
}

export async function initMonitoring(dsn = import.meta.env.VITE_SENTRY_DSN) {
  if (!dsn || sentry) return Boolean(sentry);
  try {
    const Sentry = await import("./sentryLoader");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Vercel exposes the deployed commit to Vite builds.
      release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0, // errors only
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        // Stale deploys: lazyWithReload already reloads the page for these.
        "Failed to fetch dynamically imported module",
        "Importing a module script failed",
      ],
      denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-web-extension:\/\//i],
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    sentry = Sentry;
    while (pending.length) {
      const [error, extra] = pending.shift();
      reportError(error, extra);
    }
    return true;
  } catch {
    return false;
  }
}

// Report an error. Before Sentry has loaded, a few are held and sent once it
// starts; with monitoring off they're simply dropped.
export function reportError(error, extra = {}) {
  if (!error) return;
  if (!sentry) {
    if (import.meta.env.VITE_SENTRY_DSN && pending.length < 10) pending.push([error, extra]);
    return;
  }
  try {
    sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(extra)) scope.setExtra(k, v);
      sentry.captureException(error);
    });
  } catch {
    // Never let monitoring break the page.
  }
}

// For tests only.
export function __setSentryForTests(fake) {
  sentry = fake;
}
