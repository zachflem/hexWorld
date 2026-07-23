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

## Roadmap & workflow

- **What to work on:** [design/ROADMAP.md](design/ROADMAP.md) — start with `[URGENT]` items in **Bugs & testing feedback**, then incomplete milestones.
- **Git branches:** [design/WORKFLOW.md](design/WORKFLOW.md) — ask the user which **personal branch** they use; merge finished work to **`dev`**.
- **Implementation plans:** when a feature promotes to a Milestone (or you are commissioned to plan one), write structured detail to `design/MilestoneN.md` — schemas, file layouts, verification steps. Keep the ROADMAP milestone entry brief (checklist + testable outcome + link). See [design/Milestone22.md](design/Milestone22.md) for an example.
- **Proposed features** in ROADMAP may have short descriptions only; do not expand them into full specs in ROADMAP — promote to a Milestone first.
- **Documentation:** when shipping player-visible or mechanical changes, keep [design/DESIGN.md](design/DESIGN.md) and [design/PLAYER_GUIDE.md](design/PLAYER_GUIDE.md) in sync — see ROADMAP § Documentation sync. Balance changes → [design/TWEAKS.md](design/TWEAKS.md) + profile tweaks files.
