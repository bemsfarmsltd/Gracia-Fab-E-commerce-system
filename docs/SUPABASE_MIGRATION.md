# Moving the database from MongoDB Atlas to Supabase

Status: **phase 1 done on branch `feat/supabase` (24 Nov).** The live store stays on MongoDB until the switch-over day below.
Owner: Claude Code (server and data). Started 24 Nov 2026.

## Why this is a rewrite, not a copy

Supabase is PostgreSQL (tables and rows). The store is built on MongoDB through Mongoose:

- 9 models (`server/models/`), several with nested lists: an order's items and status history, a product's reviews, a user's wishlist and interests.
- About 180 database calls in 36 server files, including 8 aggregations (admin overview, customers, reports, ratings).
- 25 of the 32 server test files run on an in-memory MongoDB.

Every one of those has to be rewritten for Postgres and re-tested. The data itself is then copied across once.

## Decisions

| Topic | Choice | Why |
|---|---|---|
| How the server talks to Postgres | Drizzle ORM + the `postgres` driver, through Supabase's connection pooler (port 6543, prepared statements off) | Light, plain SQL underneath, runs on Hostinger's Node setup; the pooler copes with Hostinger starting several app processes |
| Not `supabase-js` | — | It goes through Supabase's REST API; payments need real transactions (stock commit, points), which only a direct connection gives |
| Ids | Keep today's 24-character ids as text primary keys | Order numbers customers see (`#BD3B7F` = last 8 characters), email links, unsubscribe links and saved carts keep working |
| Nested lists | Own tables for order items, status history and reviews; `jsonb` for short lists (tags, suitable-for, interests) | Reports and stock need to query the first group; the second is only ever read whole |
| Stock at payment | One transaction: `stock = stock - n where stock >= n` | Safer than today: two payments can't both take the last item |
| Tests | PGlite (Postgres running inside the test process) replaces mongodb-memory-server | Same speed, no Docker, works in CI |
| Supabase plan | **Pro** for production | The free plan pauses a project after a week without activity and has no daily backups |

## Phases

1. **Schema and copy script.** Tables in `server/db/schema.js`; `server/scripts/copyMongoToSupabase.js` copies every collection, keeps ids, and checks counts and totals (orders, revenue, stock) match. Rehearsed against a separate Supabase project, never the production one.
2. **Port the server, one area at a time,** behind the same API so the website doesn't change: products → users/auth → orders/payments → vouchers/loyalty → admin (overview, customers, bookings, reports) → contact, reviews, marketing. Each area keeps its tests passing.
3. **Full rehearsal.** Copy a fresh snapshot to the rehearsal project, run the store end to end there (browse, register, order, Monnify sandbox payment, admin).
4. **Switch-over (about 30 minutes, early morning).** Admin notice → stop the API → final copy → set `DATABASE_URL` on Hostinger and remove `MONGO_URI` → deploy → check `/health` and a test order. Atlas stays untouched for 30 days as the way back.

Rough size: 8–10 working days for phases 1–3. Earliest switch-over: the week of 7 Dec, after the MD handover on 26 Nov so she isn't learning a system that's changing underneath her.

## Phase 1: what exists (branch `feat/supabase`)

- `server/db/schema.js`: 15 tables. Lists became their own tables (order items, status history, reviews, wishlists, points history, interests, saved recommendations). Allowed values are database rules; stock can't go below 0; ratings are 1 to 5.
- `server/db/migrations/`: the SQL that creates them. `0001` turns on row-level security on every table, so Supabase's public web API (the "anon key") can't read anything; only the server can.
- `server/scripts/copyMongoToSupabase.js` (`npm run db:copy`): reads MongoDB without changing it, converts, writes everything in one transaction, then compares users, admins, products, stock, orders, paid revenue, loyalty points, reviews, vouchers, bookings, messages and subscribers. It stops before writing on anything it can't copy faithfully: a fraction of a naira, two accounts with the same email in different capitals, an order whose customer is gone.
- Tests: `server/tests/db/` runs the copy from an in-memory MongoDB into PGlite (Postgres inside the test).

### Running it

1. Dry run, safe on production data: `cd server && npm run db:copy -- --dry-run` (needs `MONGO_URI` in `server/.env`).
2. Rehearsal copy: put the rehearsal project's pooler connection string in `DATABASE_URL` in `server/.env`, then `npm run db:copy`. To repeat it later: `COPY_TARGET_IS_REHEARSAL=yes npm run db:copy -- --replace`.
3. Passwords copy as their bcrypt hashes, so customers keep their passwords. Ids are kept, so order numbers and links keep working.

## Needed before starting

- [ ] Access to the company Supabase organisation: who owns it, and a project for rehearsal plus one for production (Pro plan)
- [ ] The region for both projects (closest to the Hostinger server)
- [ ] The connection strings, put by the owner into `server/.env` on the developer machine (rehearsal) and Hostinger (production), never into chat or the repo
- [ ] Agreement on the switch-over date with the boss and the MD
