# Deployment

Production runs on **Hostinger** since 23 Nov 2026 (moved from Render and Vercel):

| Site | What | Built from |
|---|---|---|
| `graciafab.com` / `www.graciafab.com` | the website (Vite build, static files + `client/public/.htaccess`) | `client/` |
| `api.graciafab.com` | the API (Node + Express) | `server/` |

Database: MongoDB Atlas. Background jobs: Redis (Upstash). Images: Cloudinary.

## Is everything set? Check /health

Open `https://api.graciafab.com/health`. It shows, as true/false only (never the values):

- `databaseConnected`: the API is talking to MongoDB.
- `settings`: which settings exist on the host.
- `missingRequired`: what still has to be added. Empty = done.
- `status`: `healthy` only when the database is connected and nothing required is missing; otherwise `degraded`.

## API settings (Hostinger → api.graciafab.com → Node.js app → Environment variables)

Copy the values from the old Render service (Environment tab) where it still exists; it's the same project, same values, unless marked "new".
Never paste these into chat, code or documents. After saving, restart the app.

| Variable | Required | Value / where it comes from |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `MONGO_URI` | yes | Atlas → Connect → Drivers. **Also** Atlas → Network Access: add the Hostinger server's outgoing IP (or `0.0.0.0/0`), or the connection is refused |
| `JWT_SECRET` | yes | same as before. A new one logs everybody out |
| `FRONTEND_URL` | yes | **new**: `https://www.graciafab.com` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | key yes | resend.com. Without the key no login codes are emailed, so nobody can log in |
| `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE` | yes | Monnify → Developers (live keys). Webhook URL there: **new** `https://api.graciafab.com/api/webhooks/monnify` |
| `CLOUDINARY_URL` | yes | Cloudinary dashboard → API environment variable. Without it admin photo uploads are refused |
| `REDIS_URL` | yes | Upstash → database → `rediss://…` URL. Without it order emails and WhatsApp messages are **not sent** (only logged) |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | for AI | Google AI Studio, console.groq.com. `GEMINI_MODEL` / `GROQ_MODEL` optional |
| `GOOGLE_CLIENT_ID` | for Google login | Google Cloud → Credentials. Add `https://graciafab.com` and `https://www.graciafab.com` to the client's Authorised JavaScript origins |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | for WhatsApp | Twilio console |
| `SENTRY_DSN` | optional | Sentry project `gracia-fab-server` |
| `UNSUBSCRIBE_SECRET` | optional | falls back to `JWT_SECRET` |
| `APP_VERSION` | optional | commit being deployed, shown as `version` in /health |

`PORT` is set by Hostinger; don't add it.

## Website settings (Hostinger → graciafab.com → build environment)

These are read when the site is **built**, so rebuild after changing them.

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://api.graciafab.com` (also the default in `client/src/config.js`) |
| `VITE_SITE_URL` | `https://www.graciafab.com` |
| `VITE_GOOGLE_CLIENT_ID` | same as the API's `GOOGLE_CLIENT_ID` |
| `VITE_SENTRY_DSN` | optional, Sentry project `gracia-fab-web` |

## Scheduled jobs

`server/server.js` runs two timers inside the API process: unpaid orders are cancelled after 48 hours (hourly), and marketing emails go out at 10:00. They only run while the Node process is running. If Hostinger stops the app when idle, they're skipped, so check that the app stays running (or ping /health every 10 minutes from UptimeRobot).

## Staging

The `staging` branch deployed to Render and Vercel. There's no staging site on Hostinger yet, so test locally (`CLAUDE.md` → Commands) before pushing to `main`. When one is set up, give it its own database and Redis (shared queue names would let staging jobs send real customer messages) and Monnify **sandbox** keys.

## Crash alerts (Sentry)

The server and website report crashes to Sentry once a DSN is set; without one nothing is sent.

1. Free account at sentry.io; pick the data region once (it can't be changed later).
2. Two projects: **Node.js / Express** `gracia-fab-server` and **React** `gracia-fab-web`. Skip the wizards.
3. Put the server DSN in `SENTRY_DSN` on the API and the web DSN in `VITE_SENTRY_DSN` on the website (then rebuild).
4. Keep the default "new issue" email alert in each project.

What's reported: every 500 from the API, failed email/WhatsApp/points jobs, failed scheduled jobs, uncaught server errors and page crashes. Never sent: request bodies, cookies, auth headers, IP and email addresses, secret link parameters (`server/utils/monitoring.js`, `client/src/utils/monitoring.js`).
