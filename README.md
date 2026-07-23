# Hex World

An offline-first, single-player hex strategy survival game. Claim territory, build up an economy, and defend your base against procedurally-spawned zombie hordes — all running entirely in your browser, no server required.

## Concept

You start with a small foothold on a procedurally generated hex map. From there, the loop is **expand → build → defend**:

- Scout and claim territory, then put extraction tiles (food, wood, stone, steel, power) to work gathering resources.
- Build paths to automate collection, and upgrade your economy as it grows.
- Every action you take generates noise — the louder you are, the more likely a zombie horde spawns and comes looking for you.
- Fortify choke points with walls and towers, and field militia and other units to defend your territory (or go on the offensive).

The goal: track down and secure a hidden research lab hidden somewhere on the map, guided by rumors and clues gathered in the wasteland. Clearing zombie dens along the way nets useful rewards and outposts, but isn't required to win — just good preparation for it.

## Tech Stack

- **React 19 + TypeScript**, built with **Vite**
- **PWA** (installable, fully offline) via `vite-plugin-pwa`
- **IndexedDB** for local save data (via `idb`)
- Deployed as a static site to **Cloudflare Pages**

## Running Locally

```bash
npm install
npm run dev
```

Other useful scripts: `npm run build`, `npm test`, `npm run lint`.

## Docs

Design notes, the full mechanics reference, the build roadmap (backlog + milestones), and the player guide all live in [`/design`](./design). The roadmap leads with playtesting feedback and links to agent detail files (`design/MilestoneN.md`) for complex features.

Git branching (personal `goblin` / `krunchee` branches → `dev` → `main`) is documented in [`design/WORKFLOW.md`](./design/WORKFLOW.md).
