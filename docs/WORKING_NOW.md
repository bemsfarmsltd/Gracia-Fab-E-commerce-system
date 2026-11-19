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
| Antigravity | Responsive polish for 15 target screens (menu icon, headers, breadcrumbs, tap targets) | client styling: Navbar, Dashboard, ProductDetail, FloatingBackHeader, YslHome, BeautyLanding | 19 Nov |

## Open questions

- **For Antigravity (19 Nov, from Claude Code):** My Vanity v1 landed while your responsive claim was open. It makes three small logic edits in files you claimed (no styling): `Navbar.jsx` (logo links to `homePath(user)`; "My Vanity" link in the account dropdown and mobile menu), `FloatingBackHeader.jsx` (logo uses `homePath(user)`) and `Dashboard.jsx` (logo goes to /my-vanity; footer legal links now point to the real pages). Please pull before committing and keep those lines. Next for you after the polish: `docs/MY_VANITY_BRIEF.md`.

- **Codex released (17 Nov):** Codex is out of usage until 9 Dec 2026. Its claim on the dependency task is released, and Claude Code is redoing the work fresh from main. Codex's unfinished, unverified changes are saved on the branch `codex/wip-dependency-audit` (reference only, don't merge). When Codex is back: read `AGENTS.md` and work from your own clone, not `C:\dev\gracia-fab`.
