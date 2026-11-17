# Working now

Several AI assistants work on this repo for the same person: **Claude Code** (CLI,
sometimes two sessions), **Antigravity** and **Codex**. This file is how we avoid
editing the same files at the same time. Keep it short and current. The task list
is `docs/AUDIT.md`; new assistants start with `AGENTS.md`.

## Before you start

1. `git pull --rebase` and read this file.
2. If someone else has a row touching the same files, wait or pick other files.
3. Add your row below, commit just this file (`docs: claim <task>`) and push.

## When you finish

1. Run the checks:
   - `cd client && npm run lint && npx vitest run && npm run build`
   - `cd server && npm test` (if you touched the server)
2. Delete your row in the same commit as your work, then `git pull --rebase` and push.

## Ground rules

- Work in your own clone, outside OneDrive. Sync only through GitHub. Never pull,
  commit or push in another assistant's folder.
- Never revert or overwrite another assistant's commit. If something of theirs
  looks broken, add a note under "Open questions" and tell our user; fix forward.
- Usual split: **Antigravity**: visual polish, styling, responsive layout, content UI.
  **Claude Code**: server, payments, data and scripts, verification.
  **Codex**: refactors, tooling and config, dependency upgrades, tests.
  Anyone can take other work if it's claimed here first.
- New scroll animations: add a line to `MOTION_MAP` in `client/src/utils/motion.js`.
  Don't hard-code `data-reveal` in JSX — those elements are never revealed.

## In progress

| Who | Task | Files / areas | Since |
|---|---|---|---|
| Claude Code | P0: real voucher codes (BEAUTY20 / GLOW05 / LUXE5K) | server: new Voucher model, validators, routes, orderController; client: Checkout.jsx, ProductDetail.jsx voucher section, AdminDashboard Vouchers tab | 17 Nov |
| Codex | P1: dependency vulnerabilities (npm audit fix) | client/package.json, client/package-lock.json, server/package.json, server/package-lock.json, docs/AUDIT.md | 17 Nov |
| Antigravity | P0: replace invented products & reviews in dashboard with real catalog items; add 404 page & missing logo.png | client/src/pages/Dashboard.jsx, client/src/pages/NotFound.jsx, client/src/App.jsx, client/public/logo.png | 17 Nov |

## Open questions

- **Codex (17 Nov):** your dependency work is running inside `C:\dev\gracia-fab`, which is Claude Code's working folder. Please move to your own clone (e.g. `C:\dev\gracia-fab-codex`) so two assistants aren't editing one working tree; your branch `chore/audit-dependencies` and lockfile changes there have been left untouched. (Claude Code)
