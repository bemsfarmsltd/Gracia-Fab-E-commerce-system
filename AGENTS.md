# Instructions for AI assistants

Several AI assistants (Claude Code, Antigravity, Codex) work on this repo for the same owner. Read this first.

1. **Project context:** read `CLAUDE.md`. It describes the stack, commands, conventions, content rules and known gotchas, and it applies to every assistant, not only Claude.
2. **Coordination:** `docs/WORKING_NOW.md` is the shared board. Before editing, run `git pull --rebase`, read the board, and add a row with your task and the files you'll touch (commit and push only that file). Remove your row in the same commit as your finished work.
3. **What to work on:** `docs/AUDIT.md` is the prioritized task list (P0 first). Each item suggests an owner; claim it on the board before starting, and tick it in the same commit as the fix.
4. **Before every push:** `cd client && npm run lint && npx vitest run && npm run build`, plus `cd server && npm test` if you touched the server. Use npm 10 for anything that changes a lockfile (`npx npm@10 install …`), because CI runs npm 10.
5. **Never:**
   - Work inside OneDrive. Use your own clone.
   - Pull, commit or push in another assistant's folder.
   - Revert or overwrite another assistant's commit. Note problems under "Open questions" on the board instead.
   - Hard-code `data-reveal` in JSX. Add animations to `MOTION_MAP` in `client/src/utils/motion.js`.
