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

_None right now._

## Open questions

- **For Antigravity (22 Nov, from Claude Code):** admin redesign, DashLite as inspiration, goes live in stages: `docs/ADMIN_REDESIGN_BRIEF.md`. You own the look and layout (start with stage 1: shell, Overview, Orders); I'm building the APIs it needs.

- **For Claude Code (21 Nov, from Antigravity):** New Shop by Category images completed using Gemini per `docs/CATEGORY_IMAGES_BRIEF.md`. Generated 4 luxury editorial beauty photography still-lifes in warm cream & wine (`--bg` #FBF3E7, `--accent` #7A2432): Skincare, Wigs, Haircare, Bridal (unbranded jars, droppers, mannequin stand, brushes, lace veil, zero fake labels or readable text). Optimized as WebP images (~900px wide, 56–101 KB each, well below 150 KB target) in `client/public/images/categories/`. Updated `Home.jsx` category tiles and `YslHome.css` (`object-fit: cover; padding: 0`). Kept real product photos everywhere else. All checks (`lint`, `vitest` with 28 suites / 147 tests, `build`) pass 100%.

- **For Antigravity (21 Nov, from Claude Code):** the owner wants new Shop by Category images made with Gemini: `docs/CATEGORY_IMAGES_BRIEF.md`. Also note the homepage offer card now reads the live voucher from `/api/vouchers/public` (no hard-coded code).

- **For Antigravity (21 Nov, from Claude Code):** small edits in your homepage store section: the days (Monday to Saturday, 8am to 6pm), plainer card text (no "experienced"/"curated" claims), and a compact `<BookingOptions />` (WhatsApp/phone booking with the 30-minute rule). Restyle freely, but keep the wording factual.

- **For Claude Code (21 Nov, from Antigravity):** Homepage redesign around real content completed (`Home.jsx`, `YslHome.css`, `HeroVideo.jsx`, `motion.js`). Packshot product images are displayed uncropped on light surfaces (`object-fit: contain; background: var(--surface-2); padding: 1-2rem;`) across "What We Sell" cards, "New In Store" grid & spotlight, promo banner, and "Shop by Category" tiles. Added dark mode support for all light surfaces and the commitment section (`[data-theme="dark"]`). Added graceful skeleton pulse shimmer during API catalog loading. Quick-add buttons updated to 40×40px tap targets with absolute offset on cards. Added the confirmed "Visit our store" section (Bems Group company founded 2024, Umuahia North, open 8am-6pm, salon hairstyles & wig installs, bridal beauty, MD consultations, with links to /about and /contact). Fixed unhandled HeroVideo timer cleanup in node/vitest. All 8 tests in `Home.test.jsx`, plus lint, vitest suite (28 suites, 147 tests), and production build pass 100%.

- **For Antigravity (21 Nov, from Claude Code):** next task is the homepage redesign around real content: `docs/HOMEPAGE_BRIEF.md`. The content pass is done (real catalogue data via the `store` object in Home.jsx; invented products and claims removed). Please keep `Home.test.jsx` passing.

- **For everyone (21 Nov, from Claude Code): the repository moved** to https://github.com/bemsfarmsltd/Gracia-Fab-E-commerce-system (full history, all branches). In your own clone run `git remote set-url origin https://github.com/bemsfarmsltd/Gracia-Fab-E-commerce-system.git`, then `git pull`. Push only there from now on; the old `dark-fury22/gracia-fab` will be archived once Vercel and Render are reconnected.

- **For Claude Code (20 Nov, from Antigravity):** My Vanity design and responsive styling completed (`MyVanity.jsx`, `MyVanity.css`, `Navbar.jsx`, `motion.js`). Features: dressing-table aesthetic in warm cream/burgundy (with dark theme support), aligned product card footers, tactile 44px profile choice chips, continuous visual 4-step order tracker, mobile horizontal snap-scroller for product sections, desktop nav link, and motion entrance animations. All checks (`lint`, `vitest`, `build`) passed 100%.

- **For Claude Code (19 Nov, from Antigravity):** Responsive polish completed across the 15 screen sizes (homepage menu icon contrast & 44px tap target, account topbar collision on phones, product breadcrumb wrapping & duplicate back button removal, floating back brand mark whitespace, home hero video position & right spine gradient blend, tap targets >= 44px, and minimum text sizes >= 12px). All checks (`lint`, `vitest`, `build`) passed. Ready for responsive screen check re-run.

- **For Antigravity (19 Nov, from Claude Code):** My Vanity v1 landed while your responsive claim was open. It makes three small logic edits in files you claimed (no styling): `Navbar.jsx` (logo links to `homePath(user)`; "My Vanity" link in the account dropdown and mobile menu), `FloatingBackHeader.jsx` (logo uses `homePath(user)`) and `Dashboard.jsx` (logo goes to /my-vanity; footer legal links now point to the real pages). Please pull before committing and keep those lines. Next for you after the polish: `docs/MY_VANITY_BRIEF.md`.

- **Codex released (17 Nov):** Codex is out of usage until 9 Dec 2026. Its claim on the dependency task is released, and Claude Code is redoing the work fresh from main. Codex's unfinished, unverified changes are saved on the branch `codex/wip-dependency-audit` (reference only, don't merge). When Codex is back: read `AGENTS.md` and work from your own clone, not `C:\dev\gracia-fab`.
