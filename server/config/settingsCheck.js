import mongoose from "mongoose";

// Which server settings are present, as yes/no only (never the values), so
// whoever fills in the host's environment variables can see what's missing
// from /health. `required` ones break the store when absent; the rest switch
// one feature off.
const has = (...names) => names.every((n) => Boolean(process.env[n]));

export const SETTINGS = [
  { key: "database", required: true, check: () => has("MONGO_URI") },
  { key: "loginTokens", required: true, check: () => has("JWT_SECRET") },
  { key: "siteAddress", required: true, check: () => has("FRONTEND_URL") },
  { key: "email", required: true, check: () => has("RESEND_API_KEY") },
  { key: "payments", required: true, check: () => has("MONNIFY_API_KEY", "MONNIFY_SECRET_KEY", "MONNIFY_CONTRACT_CODE") },
  { key: "imageUploads", required: true, check: () => has("CLOUDINARY_URL") || has("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET") },
  { key: "backgroundJobs", required: true, check: () => has("REDIS_URL") },
  { key: "ai", required: false, check: () => has("GEMINI_API_KEY") || has("GROQ_API_KEY") },
  { key: "googleLogin", required: false, check: () => has("GOOGLE_CLIENT_ID") },
  { key: "whatsapp", required: false, check: () => has("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM") },
  { key: "crashAlerts", required: false, check: () => has("SENTRY_DSN") },
];

export function settingsReport() {
  const settings = {};
  const missingRequired = [];
  for (const s of SETTINGS) {
    const ok = s.check();
    settings[s.key] = ok;
    if (s.required && !ok) missingRequired.push(s.key);
  }
  return {
    databaseConnected: mongoose.connection.readyState === 1,
    settings,
    missingRequired,
  };
}
