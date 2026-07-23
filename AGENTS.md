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
