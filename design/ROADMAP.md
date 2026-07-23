# Hex World — ROADMAP.md

## Table of contents

- [About this project](#about-this-project)
- [Roadmap maintenance](#roadmap-maintenance)
  - [Documentation sync](#documentation-sync)
- [Bugs & testing feedback](#bugs--testing-feedback)
  - [Bugs](#bugs)
  - [UI](#ui)
  - [UX](#ux)
  - [Recently resolved](#recently-resolved)
- [Questions & thoughts](#questions--thoughts)
- [Proposed features](#proposed-features)
- [Milestones](#milestones)
  - [Incomplete milestones](#incomplete-milestones)
  - [Completed milestones](#completed-milestones)

---

## About this project

Hex World is an offline-first, single-player hex strategy survival PWA. You claim territory, build an economy, and defend against zombie hordes drawn by noise — all in the browser, no server. Sessions are designed as 30–90 minute skirmishes: find and secure a hidden lab to win, or lose your base and the run ends.

This document tracks **what to build next** (playtesting backlog first), **open design questions**, **proposed features**, and **milestone history**. For systems and fiction see [DESIGN.md](DESIGN.md); for balance numbers see [TWEAKS.md](TWEAKS.md); for player-facing help see [PLAYER_GUIDE.md](PLAYER_GUIDE.md); for git branches see [WORKFLOW.md](WORKFLOW.md).

---

## Roadmap maintenance

### Priority order

1. `[URGENT]` bugs in [Bugs & testing feedback](#bugs--testing-feedback)
2. Other bugs, UI, UX, and balance feedback in the same section
3. [Incomplete milestones](#incomplete-milestones)
4. [Proposed features](#proposed-features)
5. [Questions & thoughts](#questions--thoughts) (ideas and deferred items)

### Item lifecycle

| Stage | Where | Detail level | Detail file? |
|-------|-------|--------------|--------------|
| **Ideas** | Questions § Ideas | Raw brainstorm | No |
| **Open questions** | Questions § Open | Problem statement; options unset | No |
| **Deferred** | Questions § Deferred | Consciously out of scope for now | No |
| **Proposed features** | Proposed Features § | Short description — intent, player-facing goal, rough scope; `#Pn` ID, refs, next step. No structured implementation detail. | No |
| **Milestone** | Milestones § | Checklist + testable outcome (concise) | Yes when non-trivial — `design/MilestoneN.md` |
| **Completed milestone** | Milestones § (collapsible) | Summary + testable outcome | Link to detail file if exists |

**Promotion rules (humans and agents):**

1. **Ideas → Open questions** when a design decision is needed before any implementation.
2. **Open questions → Proposed** when direction is agreed but scope/timing is not — add `#Pn` entry with a short plain-English description.
3. **Proposed → Milestone** when there is a clear checklist and testable outcome — assign next number (**24**), move or mark item *Promoted to M24*, add checklist in Milestones.
4. **Structured detail stays out of ROADMAP** (even in Proposed): file layouts, schemas, page sequences, step-by-step agent instructions, verification scripts, code snippets → `design/MilestoneN.md`, created when the feature **promotes to a Milestone** or when an agent is explicitly commissioned to plan one. Do not let proposed entries grow into pseudo-milestone docs; promote instead.

### Documentation sync

Keep the design docs aligned with the code. Stale docs cause the mismatches we have been cleaning up (e.g. old onboarding flow, win-condition wording).

| Doc | Update when… | Voice / content |
|-----|--------------|-----------------|
| **[DESIGN.md](DESIGN.md)** | Systems, mechanics, scope, architecture, or in-fiction rules change | Authoritative *design intent* — why systems exist, how they interact, what's in/out of scope |
| **[PLAYER_GUIDE.md](PLAYER_GUIDE.md)** | **Player-visible** behavior changes — controls, flows, UI labels, what the player can do | Plain English for players; describes the game *as it currently plays* |
| **[TWEAKS.md](TWEAKS.md)** | Balance numbers or formulas change | Plain-English companion to `tweaks.jsonc`; note corrections with date/reason |
| **ROADMAP.md** | Backlog status, milestones, proposed features | What to build next; not a substitute for DESIGN or PLAYER_GUIDE |

**When to update (agents and devs):**

- **Bug fix** that changes player-visible behavior → PLAYER_GUIDE if a section describes the old behavior; DESIGN only if mechanics changed.
- **New or changed mechanic** → DESIGN.md first (or alongside code); PLAYER_GUIDE when the feature is player-facing and shipped.
- **Balance-only change** → profile `tweaks.jsonc` + TWEAKS.md; ROADMAP backlog item → Resolved. Usually no PLAYER_GUIDE change unless yields/costs are spelled out there.
- **Milestone ✅** → before marking complete, check whether DESIGN and/or PLAYER_GUIDE need a pass; include doc updates in the same PR/merge as the code when they apply.
- **Do not duplicate** — ROADMAP tracks *status*; DESIGN holds *systems*; PLAYER_GUIDE holds *how to play*; TWEAKS holds *numbers*. Link between them instead of copying paragraphs.

### Other rules

| Topic | Rule |
|-------|------|
| **Backlog format** | `- **Title.** (#id) Description. **Refs:** … Status: Open / In progress / Resolved (YYYY-MM-DD)` |
| **Bug IDs** | `#1`–`#16` — preserve existing IDs when adding new items ([TWEAKS.md](TWEAKS.md) references `#12`) |
| **Proposed IDs** | `#P1`, `#P2`, … (P = proposed) |
| **`[URGENT]`** | Prefix when play is blocked or game state is misleading |
| **Balance fixes** | Backlog → `public/profiles/{slug}/tweaks.jsonc` → note in [TWEAKS.md](TWEAKS.md) → Resolved |
| **Milestone DoD** | Mark ✅ only when every checklist item is done and verified; `npm test` + `npm run build`; update [DESIGN.md](DESIGN.md) / [PLAYER_GUIDE.md](PLAYER_GUIDE.md) when the change affects them (see Documentation sync above) |
| **Detail files** | Agent-generated plans with schemas, layouts, verification → [Milestone22.md](Milestone22.md) is the template; ROADMAP entry stays brief + link |
| **Collapsible blocks** | Use `<details>` / `<summary>` for completed milestones, recently resolved, deferred, and ideas (see completed section below) |
| **Agent git workflow** | See [WORKFLOW.md](WORKFLOW.md). Ask the user which **personal branch** they use; do not assume `goblin` or `krunchee`. Merge finished work to **`dev`**. |

*Last updated: 2026-07-23 (playtesting: #15, #16, #14 expanded)*

---

## Bugs & testing feedback

Playtesting findings from Milestone 21 and ongoing sessions. **Priority for development.**

### Bugs

- **[URGENT] Barracks keeps training while damaged.** (#1) A damaged barracks should stop producing/training the same way a damaged extraction tile stops yielding. **Refs:** [`src/data/barracks.ts`](../src/data/barracks.ts), [`src/engine/barracks.ts`](../src/engine/barracks.ts), `isStructureActive` pattern in [`src/data/extractionTiles.ts`](../src/data/extractionTiles.ts). Status: Open.
- **Unit training selectable during barracks build timer.** (#3) Should stay locked until `buildStartedAt` clears. **Refs:** [`src/data/barracks.ts`](../src/data/barracks.ts), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx). Status: Open.
- **Only one build/upgrade action per structure at a time.** (#4) Base reinforcement-HP track and level upgrade can run concurrently; they should share one in-progress slot (like walls). **Refs:** [`src/engine/base.ts`](../src/engine/base.ts), [`src/data/walls.ts`](../src/data/walls.ts). Status: Open.
- **Training needs to be one queue per barracks.** (#5) ~~Two unit types at once should require two barracks.~~ **Resolved 2026-07-23** — `Barracks.trainingQueue`; speed scales with that barracks's level only. **Refs:** [`src/engine/barracks.ts`](../src/engine/barracks.ts), [`src/data/barracks.ts`](../src/data/barracks.ts).
- **[URGENT] Scout skiffs stuck at home dock.** (#6) Never wander off; reproduced at 5× speed for 1+ simulated hour. **Refs:** [`src/engine/scoutSkiffs.ts`](../src/engine/scoutSkiffs.ts), [`src/data/scoutSkiffs.ts`](../src/data/scoutSkiffs.ts). Status: Open.
- **[URGENT] Extraction tiles yield during build timer.** (#8) Should yield nothing until `buildStartedAt` clears. **Refs:** [`src/engine/tick.ts`](../src/engine/tick.ts), [`src/data/extractionTiles.ts`](../src/data/extractionTiles.ts). Status: Open.
- **[URGENT] Recalled garrison cannot join expeditions.** (#9) After recall with zero losses, expedition dispatch fails; re-garrison still works. Possibly related to militia dispatch count bug. **Refs:** [`src/App.tsx`](../src/App.tsx), [`src/engine/expeditions.ts`](../src/engine/expeditions.ts), [`src/engine/garrisons.ts`](../src/engine/garrisons.ts). Status: Open.
- **Base not centered after page refresh.** (#15) On reload, the map viewport shows the base toward the top-left instead of centered. **Investigation:** [`HexCanvas.tsx`](../src/render/HexCanvas.tsx) sets initial `pan` once while `pan === null` (lines ~446–452) using `canvas.width/height`, but `ResizeObserver` resizes the canvas afterward without updating `pan` (~510–514). Likely race: center runs at default canvas size, then layout resize leaves pan stale. **`recenterOnBase()`** already has the correct math — initial load should match it (re-run center after first resize, or derive pan from `container.clientWidth/Height`). Status: Open.

### UI

*(No open UI items — see Recently resolved for #7, #13.)*

### UX

- **Map size choice during onboarding.** (#10) 48×48 / 96×96 / 128×128; den count and pacing must scale, not just grid resize. **Refs:** [DESIGN.md §3](DESIGN.md), [`src/ui/onboarding/OnboardingScreen.tsx`](../src/ui/onboarding/OnboardingScreen.tsx). Status: Open — see also [#P2](#map-size-selection-p2).
- **Unit training missing from notification tray.** (#16) ~~Scout/militia/knight/sniper training queues show progress only inside the Military sheet~~ **Resolved 2026-07-23** — per-barracks training rows in [`activeCountdownRows()`](../src/ui/GameScreen.tsx) → [`NotificationTray`](../src/ui/hud/NotificationTray.tsx).
- **Timer notifications should auto-collapse.** (#14) After 5s realtime, expand full label/countdown then slide to **icon only**; tap/click icon to re-expand. Applies to **both** one-off toasts ([`ToastStack`](../src/ui/hud/Toast.tsx)) **and** countdown rows in [`NotificationTray`](../src/ui/hud/NotificationTray.tsx) (builds, upgrades, repairs, training, expeditions, assaults, recalls, sieges). Player should still see at a glance how many timers are in flight when collapsed. **Refs:** [`NotificationTray.tsx`](../src/ui/hud/NotificationTray.tsx), [`GameScreen.tsx`](../src/ui/GameScreen.tsx) `activeCountdownRows()`. Status: Open.

<details>
<summary><strong>Recently resolved</strong></summary>

- **Early game pacing too slow.** (#12) Resolved 2026-07-23 — small-tier extraction yields raised ~50%; every flat build/upgrade timer shaved 1 minute. **Refs:** [`public/profiles/default/tweaks.jsonc`](../public/profiles/default/tweaks.jsonc), [TWEAKS.md](TWEAKS.md).
- **Building sprite vertical alignment.** (#7) Resolved 2026-07-23 — bottom-anchored structure icons via [`src/render/structurePlacement.ts`](../src/render/structurePlacement.ts) and `drawPlacedStructureIcon` in [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx).
- **Extraction upgrade badge and stockpile cue.** (#13) Resolved 2026-07-23 — upgrade badge via `upgradeAvailableKeysFor()`; stockpile urgency on collect pin ([`CollectPinOverlay`](../src/ui/menu/CollectPinOverlay.tsx), [`stockpileState.ts`](../src/render/stockpileState.ts)).
- **Per-barracks training queues + tray countdowns.** (#5, #16) Resolved 2026-07-23 — one queue per barracks (any unit type); training speed scales with that barracks's level; legacy global queues migrate on load; notification tray shows per-barracks training timers. **Refs:** [`src/engine/barracks.ts`](../src/engine/barracks.ts), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx).

</details>

---

## Questions & thoughts

### Open questions

- **Should extraction tiles run dry?** (#2) Finite pool per tier that depletes and stops yielding, vs yielding forever. Needs design pass on tier upgrades, storage, and auto-flow assumptions. **Refs:** [DESIGN.md §7](DESIGN.md), [TWEAKS.md § Extraction Tiles](TWEAKS.md).

<details>
<summary><strong>Deferred / out of scope</strong></summary>

- **Multiplayer / PvP** — retired concept. **Refs:** [DESIGN.md §15](DESIGN.md).
- **Environmental map events** — not planned for current build.
- **Auto-repair skill for walls** — mentioned as future possibility in [DESIGN.md §15](DESIGN.md).

*(Admin tweaks GUI, water transport, and similar items with clearer direction live under [Proposed features](#proposed-features) instead.)*

</details>

<details>
<summary><strong>Ideas</strong></summary>

*(Empty — add raw brainstorms here: art directions, mechanic sketches, UX sparks.)*

</details>

---

## Proposed features

Features past the Ideas/Questions stage but not yet scheduled as a Milestone. **Short descriptions only** — structured specs belong in `design/MilestoneN.md` after promotion.

### Admin tweaks GUI (#P1)

In-browser visual editor for balance values; zip import/export of profile folders for deploy. Large scope — likely its own milestone when scheduled. **Refs:** [DESIGN.md §15](DESIGN.md), [TWEAKS.md § Difficulty profiles](TWEAKS.md). **Next step:** design pass on editor scope and security model.

### Map size selection (#P2)

Onboarding choice among 48×48 / 96×96 / 128×128; den count and overall pacing must scale with grid size, not just resize the map. **Refs:** UX [#10](#map-size-choice-during-onboarding-10), onboarding future-slot in [Milestone22.md](Milestone22.md), world-gen. **Next step:** design pass on density formulas.

### Watchtower intel & alerts (#P3)

Towers gain a distinct intel/alert role: passive lab-clue rolls on tick and horde-approach notifications. Tweak keys exist in schema but have no engine reader. **Refs:** [DESIGN.md §11](DESIGN.md), [Milestone 15 gap](#milestone-15--hidden-lab--win-condition--️-partial), `lab_clues.passive_surfacing.*` in tweaks. **Next step:** promote to milestone or extend M15/M16.

### Trade caravan (#P4)

Tech-tree upgrade path for manual outpost ↔ base resource transfer (manual → bike couriers → electric van), hooking into outposts' separate storage pools. **Refs:** [DESIGN.md §15](DESIGN.md), [TWEAKS.md § Outposts](TWEAKS.md). **Next step:** design tier costs and UI entry point.

### Touch structure stats (#P5)

Mobile-friendly equivalent of the M20 desktop hover tooltip; Info hex is a partial fallback today. **Refs:** [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx), Milestone 20. **Next step:** UX sketch for touch/long-press vs persistent panel.

### Water resource transport (#P6)

Path-style automation across water bodies, beyond each dock depositing directly to base storage. **Refs:** [DESIGN.md §15](DESIGN.md), [TWEAKS.md § Infrastructure Paths](TWEAKS.md). **Next step:** reconcile with dock model in [DESIGN.md §16](DESIGN.md).

### PWA install screenshots (#P7)

Add manifest `screenshots` entries (wide + mobile) for Chrome's richer install prompt. **Refs:** [Milestone 16](#milestone-16--ui-polish-pass--️-partial), `vite.config.ts` PWA plugin. **Next step:** capture screenshots and add to manifest.

### Extra difficulty profiles (#P8)

Additional sibling packs (e.g. casual, speedrun) under `public/profiles/`, same layout as default/hard. **Refs:** [`public/profiles/index.json`](../public/profiles/index.json), Milestone 23. **Next step:** balance pass + optional partial art overrides.

### Per-tick horde tile combat (#P9)

Hordes attrition against walls/towers over time on a tile, replacing the current one-shot resolution for tile fights. **Refs:** [TWEAKS.md § Horde System](TWEAKS.md). **Next step:** design pass on combat loop vs performance.

### Terrain tile defense (#P10)

Terrain type multiplies tile claim difficulty (e.g. mountains harder than grassland), on top of distance-based defense. **Refs:** [TWEAKS.md § Territory Expansion](TWEAKS.md), [DESIGN.md §6](DESIGN.md). **Next step:** tuning table in tweaks.

---

## Milestones

Milestones are sequenced build chunks, each with a **testable outcome**. Mark ✅ only when every item is complete **and** verified (`npm test`, `npm run build`, manual check where needed). Complex agent plans → `design/MilestoneN.md`.

### Incomplete milestones

#### Milestone 15 — Hidden Lab & Win Condition — ⚠️ Partial

Lab placement, scout-action clue rolls, den-clear guaranteed clues, guardian fight, and lab-only win condition are shipped. Win does not require clearing dens.

- ❌ Watchtower-tick passive clue surfacing — `lab_clues.passive_surfacing.per_watchtower_tick_base_chance` / `watchtower_intel_tier_multiplier` in schema, no engine reader
- ✅ Scout-action passive clues (`rollScoutClue`)
- ✅ Guaranteed clue per den clear
- ✅ Secure lab alone triggers win

**Testable outcome:** locate and secure the lab without clearing any den → win screen; clearing a den still awards its clue and converts to outpost.

**Refs:** [`src/data/lab.ts`](../src/data/lab.ts), [DESIGN.md §13](DESIGN.md).

#### Milestone 16 — UI Polish Pass — ⚠️ Partial

Much of original scope superseded by Milestone 20 (hex-ring menu, HUD chips, textures, desktop hover tooltip).

- ✅ Icon-led HUD, settings/notifications panel, terrain/resource art (via M20)
- ❌ Watchtower intel/alert role (separate from combat range) — see [#P3](#watchtower-intel--alerts-p3)
- ❌ PWA manifest `screenshots` for rich install UI — see [#P7](#pwa-install-screenshots-p7)

**Testable outcome:** first-time player understands state and options without external explanation.

#### Milestone 17 — Offline Resilience & Save Files — ⚠️ Partial

- ✅ Long offline gaps resolve correctly (timers, hordes, upkeep, outposts)
- ✅ IndexedDB corruption/recovery for auto-save session
- ❌ Save-to-file (download JSON)
- ❌ Load-from-file (file picker, defensive parse, no anti-tamper)

**Testable outcome:** multi-hour offline gap reflects correct elapsed state; save file loads on fresh browser profile with matching state.

**Refs:** [`src/data/gamePersistence.ts`](../src/data/gamePersistence.ts), [DESIGN.md §17](DESIGN.md).

---

### Completed milestones

<details>
<summary><strong>Completed milestones (M0–M23, oldest → newest)</strong></summary>

<details>
<summary><strong>Milestone 0 — Project Scaffold — ✅ Complete</strong></summary>

Vite + React PWA, IndexedDB wrapper, tweaks load at boot, onboarding → game routing.

**Testable outcome:** app installs as PWA, works offline, loads config without network.

</details>

<details>
<summary><strong>Milestone 1 — Onboarding & Player Identity — ✅ Complete</strong></summary>

Name, colour picker, player persisted to IndexedDB.

**Testable outcome:** create player, refresh, state survives.

</details>

<details>
<summary><strong>Milestone 2 — Hex Grid Rendering — ✅ Complete</strong></summary>

Procedural terrain, axial hex coords, 128×128 render with culling, pan/zoom, fog of war.

**Testable outcome:** same seed → same map; fog matches DESIGN.md §6.

</details>

<details>
<summary><strong>Milestone 3 — Starting Territory & Spawn — ✅ Complete</strong></summary>

Base + 19 starting tiles, starting resources from tweaks, tile click popup shell.

**Testable outcome:** new player owns 19 tiles, correct starting resources.

</details>

<details>
<summary><strong>Milestone 4 — Resource Economy Core — ✅ Complete</strong></summary>

Extraction tile model, real-time tick engine (offline-safe), build + passive yield, storage caps.

**Testable outcome:** build food tile, close app 1 hour, reopen with correct accumulated resources (capped).

</details>

<details>
<summary><strong>Milestone 5 — Extraction Tiers & Upgrades — ✅ Complete</strong></summary>

Small→mid→large tiers, storage skill upgrades, transition tiles at half yield.

**Testable outcome:** upgrade through all tiers; costs/yields match TWEAKS.md.

</details>

<details>
<summary><strong>Milestone 6 — Manual Collection & Infrastructure Paths — ✅ Complete</strong></summary>

Manual collection, path build/upgrade, auto-flow to base when connected.

**Testable outcome:** path-connected tile fills base storage without clicks; disconnected tile does not.

</details>

<details>
<summary><strong>Milestone 7 — Noise System — ✅ Complete</strong></summary>

Passive + action noise, floor convergence, display.

**Testable outcome:** noise rises with actions, decays toward floor; matches TWEAKS.md.

</details>

<details>
<summary><strong>Milestone 8 — Towers & Walls — ✅ Complete</strong></summary>

Tower/wall build and upgrade, repair (peacetime), demolish with 60% refund.

**Testable outcome:** place tower/wall, verify math, demolish and confirm refund.

</details>

<details>
<summary><strong>Milestone 9 — Barracks & Units — ✅ Complete</strong></summary>

Barracks L1–4, scouts (one-time reveal), militia (upkeep, attack/defense stats).

**Testable outcome:** train units, spend scout to reveal tile, verify upkeep/desertion.

</details>

<details>
<summary><strong>Milestone 10 — Territory Expansion — ✅ Complete</strong></summary>

Base level upgrades, tile assault (later superseded by expedition system), adjacency + radius gating, deterministic combat.

**Testable outcome:** upgrade base, claim tiles via militia/expedition; lose committed units on failure.

*Note: single-tile attack generalized to multi-tile expeditions (`engine/expeditions.ts`).*

</details>

<details>
<summary><strong>Milestone 11 — Horde Spawning & Pathfinding — ✅ Complete</strong></summary>

Per-den spawn loop, size/cooldown formulas, pathfinding to noise source, tile advance.

**Testable outcome:** high noise near den → horde spawns and paths toward base.

</details>

<details>
<summary><strong>Milestone 12 — Tower/Wall Combat — ✅ Complete</strong></summary>

Tower attrition per tick, wall durability, base reinforcement HP + loss condition.

**Testable outcome:** defended chokepoint slows horde; base HP 0 ends session.

</details>

<details>
<summary><strong>Milestone 13 — Territory Disconnection — ✅ Complete</strong></summary>

Connectivity check after horde capture; disconnected section loses resources, buildings damaged.

**Testable outcome:** horde severs territory → correct section flagged, not whole map.

</details>

<details>
<summary><strong>Milestone 14 — Dens, Siege & Outposts — ✅ Complete</strong></summary>

Den placement at world-gen (fixed level), assault + hold + outpost conversion, horde loss generalized to outposts.

**Testable outcome:** clear den through hold → outpost with separate storage; outpost loss reverts to den.

</details>

<details>
<summary><strong>Milestone 18 — Base Relocation — ✅ Complete</strong></summary>

Relocate base to known empty land tile (L3+ gate), cost/duration scale with distance, persists offline.

**Testable outcome:** relocate, countdown completes (incl. offline gap), base moves, destination owned.

**Refs:** [`src/engine/base.ts`](../src/engine/base.ts).

</details>

<details>
<summary><strong>Milestone 19 — Docks & Water Units — ✅ Complete</strong></summary>

Docks, fishing boat, scout skiff, wandering scout; water no longer dead space.

**Testable outcome:** dock yields food; boat boosts yield; skiff/scout reveal tiles over time.

**Refs:** [DESIGN.md §16](DESIGN.md), [TWEAKS.md § Docks](TWEAKS.md).

</details>

<details>
<summary><strong>Milestone 20 — UI Enrichment — ✅ Complete</strong></summary>

Hex-ring action menu, global hex cluster panels, HUD chips, path textures, marker icons, desktop hover tooltip.

**Testable outcome:** full tile actions via ring menu; all panels reachable; desktop hover shows correct stats.

</details>

<details>
<summary><strong>Milestone 21 — Stability & UX Backlog — ✅ Complete</strong></summary>

Playtesting backlog reorganized into dedicated ROADMAP sections (Bugs, Questions, Proposed Features) — 2026-07-23.

</details>

<details>
<summary><strong>Milestone 22 — Onboarding: Field Manual — ✅ Complete</strong></summary>

Paged field-manual onboarding, continue-or-new-game prompt, advanced options (difficulty, seed, recent seeds).

**Testable outcome:** new player completes manual → game with chosen identity; returning save → continue prompt.

**Detail file:** [Milestone22.md](Milestone22.md).

</details>

<details>
<summary><strong>Milestone 23 — Difficulty Profiles & Asset Packs — ✅ Complete</strong></summary>

URL slugs, bundled `public/profiles/{slug}/`, partial sprite overrides with default fallback, profile persisted in save.

**Testable outcome:** `/hard` loads hard profile; continue prompt on reload; `profiles/index.json` lists difficulties.

</details>

</details>
