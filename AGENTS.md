# AGENTS.md

## Cursor Cloud specific instructions

Hex World is a single, fully client-side React 19 + TypeScript app built with Vite 8 (a PWA game). There is **no backend, database, or external service** — state lives in memory (Zustand) and saves persist to the browser's IndexedDB. No environment variables or secrets are required.

Standard commands are already documented in `README.md` and `package.json` scripts; use those. In short:

- `npm run dev` — Vite dev server on `http://localhost:5173/`. This is the only service needed to run/test the product end-to-end (open it in a browser).
- `npm test` — Vitest suite (Node environment; no browser needed).
- `npm run lint` — oxlint (currently emits a few warnings but exits 0).
- `npm run build` — `tsc -b && vite build` (also generates the PWA service worker).

Non-obvious notes:

- The dev server binds to localhost only; it is not exposed on the network by default (would need `--host`).
- Runtime game balance/tuning is loaded from per-profile `public/profiles/{slug}/tweaks.jsonc` (validated with Zod via `src/data/tweaksLoader.ts`), not from code — edit those files to change tuning.
- Because saves live in IndexedDB, clearing browser site data resets game progress.

## Backlog & workflow (GitHub-first)

- **What to work on:** GitHub Issues + Project [hexWorld](https://github.com/users/zachflem/projects/1). Priority: `urgent` / `[URGENT]` titles → open milestone leftovers → `proposed`. Use `gh issue list` (never invent local backlog files).
- **Do not edit** [`context/ROADMAP.retired.md`](context/ROADMAP.retired.md) — historical only.
- **Git branches:** [context/WORKFLOW.md](context/WORKFLOW.md) — ask which **personal branch** the user uses; merge finished work to **`dev`**.
- **Filing / updating issues:** install and use the prompted `/issue` skill from private [`zachflem/dev-tools`](https://github.com/zachflem/dev-tools):

  ```bash
  gh api repos/zachflem/dev-tools/contents/install.sh --jq .content | base64 -d | bash
  ```

  Interview the human, suggest refs from context, show a preview, and **only run `gh issue create` (or other state-changing `gh` commands) after explicit human approval**.

- **gh scopes:** `repo` for Issues; for Projects run  
  `gh auth refresh -h github.com -s project,read:project`  
  if board commands fail.

- **Implementation plans:** when a feature promotes to a Milestone (or you are commissioned to plan one), write structured detail to `context/MilestoneN.md` with a `GitHub:` link to the milestone/issue. Keep the GitHub issue checklist brief + link.
- **Documentation:** when shipping player-visible or mechanical changes, keep [context/DESIGN.md](context/DESIGN.md) and [context/PLAYER_GUIDE.md](context/PLAYER_GUIDE.md) in sync — see [context/README.md](context/README.md). Balance changes → [context/TWEAKS.md](context/TWEAKS.md) + profile tweaks files.
