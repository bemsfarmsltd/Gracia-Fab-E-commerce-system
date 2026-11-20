// Loaded only when crash alerts are on (see monitoring.js). A separate file
// so the bundler gives the Sentry code a predictable name, which the offline
// cache skips (vite.config.js globIgnores).
export * from "@sentry/react";
