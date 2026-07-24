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
| **Bug IDs** | `#1`–`#20` — preserve existing IDs when adding new items ([TWEAKS.md](TWEAKS.md) references `#12`) |
| **Proposed IDs** | `#P1`, `#P2`, … (P = proposed) |
| **`[URGENT]`** | Prefix when play is blocked or game state is misleading |
| **Balance fixes** | Backlog → `public/profiles/{slug}/tweaks.jsonc` → note in [TWEAKS.md](TWEAKS.md) → Resolved |
| **Milestone DoD** | Mark ✅ only when every checklist item is done and verified; `npm test` + `npm run build`; update [DESIGN.md](DESIGN.md) / [PLAYER_GUIDE.md](PLAYER_GUIDE.md) when the change affects them (see Documentation sync above) |
| **Detail files** | Agent-generated plans with schemas, layouts, verification → [Milestone22.md](Milestone22.md) is the template; ROADMAP entry stays brief + link |
| **Collapsible blocks** | Use `<details>` / `<summary>` for completed milestones, recently resolved, deferred, and ideas (see completed section below) |
| **Agent git workflow** | See [WORKFLOW.md](WORKFLOW.md). Ask the user which **personal branch** they use; do not assume `goblin` or `krunchee`. Merge finished work to **`dev`**. |

*Last updated: 2026-07-24 (#20 resolved — mobile toast below resource HUD)*

---

## Bugs & testing feedback

Playtesting findings from Milestone 21 and ongoing sessions. **Priority for development.**

### Bugs

*(No open bugs — see Recently resolved for #20.)*

### UI

*(No open UI items — see Recently resolved for #7, #13, #15–#17, #19.)*

### UX

*(No open UX items — see Recently resolved for #18.)*

<details>
<summary><strong>Recently resolved</strong></summary>

- **Toast notifications sit above the resource bar on mobile, obscuring the noise meter.** (#20) Resolved 2026-07-24 — `ResourceHud` reports scaled height; toast/tray column drops below the HUD when the bar shrinks on narrow viewports (`scale < 1`). **Refs:** [`src/ui/hud/ResourceHud.tsx`](../src/ui/hud/ResourceHud.tsx), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx).
- **Notification coord link selects tile but does not pan.** (#19) Resolved 2026-07-24 — `centerOnCoord` no longer bails when `pan` is null; uses container dimensions; pan deferred via `requestAnimationFrame` from `goToTile`. **Refs:** [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx), [`src/ui/hud/CoordLink.tsx`](../src/ui/hud/CoordLink.tsx).
- **Toast when a horde damages a structure.** (#18) Resolved 2026-07-24 — `hordeStructureCaptureEvents` + `pushToast` on capture tick; skull icon, clickable coord link, detail line for cancelled build/upgrade/training. **Refs:** [`src/engine/hordes.ts`](../src/engine/hordes.ts), [`src/App.tsx`](../src/App.tsx), [`src/ui/hud/Toast.tsx`](../src/ui/hud/Toast.tsx).
- **Settings new-game flow.** Resolved 2026-07-23 — removed Recenter from Settings (map controls only); new-game choices (replay / new seed / new player) live inline in the Settings sheet instead of behind a New Game button; discard warning moved to a confirm popup on Start. **Refs:** [`src/ui/panels/SettingsPanel.tsx`](../src/ui/panels/SettingsPanel.tsx), [`src/ui/NewGameOptions.tsx`](../src/ui/NewGameOptions.tsx), [PLAYER_GUIDE.md](PLAYER_GUIDE.md).
- **Garrisoning a new tile wipes other garrisons.** Resolved 2026-07-23 — first station on a fresh tile replaced the whole `garrisons` array with a one-element list, so earlier towers lost their troops (looked like a transfer). Fixed via shared `mergeIntoGarrison` that appends instead of replacing. **Refs:** [`src/engine/garrisons.ts`](../src/engine/garrisons.ts) `mergeIntoGarrison`, [`src/App.tsx`](../src/App.tsx) `handleGarrisonUnits`.
- **Map camera controls.** (#17) Resolved 2026-07-23 — bottom-left hex stack: zoom in/out (hold to repeat) and recenter on base (keeps current zoom). Recenter removed from Settings (map controls are the sole entry point). **Refs:** [`src/ui/hud/MapControls.tsx`](../src/ui/hud/MapControls.tsx), [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx) `zoomBy` / `recenterOnBase`, [PLAYER_GUIDE.md](PLAYER_GUIDE.md).
- **Resource HUD rate chip layout.** Resolved 2026-07-23 — net ±/sec chip floats at top-right of the amount instead of wrapping onto a new row and shifting the HUD. **Refs:** [`src/ui/hud/ResourceHud.tsx`](../src/ui/hud/ResourceHud.tsx).
- **Base sheet missing status.** Resolved 2026-07-23 — base tile sheet Info tab shows operational status, reinforcement HP, noise cap, and per-resource storage fill vs capacity; Storage upgrade rows show current cap. **Refs:** [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx) `infoSheetContent`, [PLAYER_GUIDE.md](PLAYER_GUIDE.md).
- **Map size choice during onboarding.** (#10, #P2) Resolved 2026-07-23 — 48×48 / 96×96 / 128×128 under **Show Advanced Options**; `WorldRecord.gridSize` persisted; den count and min distances scale via `tweaksForMapSize()`. Profile scenario overrides: `game.grid_size_locked` + `game.world_seed` in tweaks take precedence over onboarding. Replay/new-seed from the in-game New Game dialog keep the save's size; new player re-enters onboarding (map size there). **Refs:** [`src/data/mapSize.ts`](../src/data/mapSize.ts), [`OnboardingScreen.tsx`](../src/ui/onboarding/OnboardingScreen.tsx), [TWEAKS.md § Game / world](TWEAKS.md).
- **Timer notifications should auto-collapse.** (#14) Resolved 2026-07-23 — shared `CollapsibleNotificationRow`: 5s full expand, slide right to icon peek; tap icon to re-expand. Countdown rows stay peeking; one-off toasts dismiss after 8s collapsed. **Refs:** [`src/ui/hud/CollapsibleNotificationRow.tsx`](../src/ui/hud/CollapsibleNotificationRow.tsx), [`NotificationTray.tsx`](../src/ui/hud/NotificationTray.tsx), [`Toast.tsx`](../src/ui/hud/Toast.tsx).
- **Early game pacing too slow.** (#12) Resolved 2026-07-23 — small-tier extraction yields raised ~50%; every flat build/upgrade timer shaved 1 minute. **Refs:** [`public/profiles/default/tweaks.jsonc`](../public/profiles/default/tweaks.jsonc), [TWEAKS.md](TWEAKS.md).
- **Building sprite vertical alignment.** (#7) Resolved 2026-07-23 — bottom-anchored structure icons via [`src/render/structurePlacement.ts`](../src/render/structurePlacement.ts) and `drawPlacedStructureIcon` in [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx).
- **Extraction upgrade badge and stockpile cue.** (#13) Resolved 2026-07-23 — upgrade badge via `upgradeAvailableKeysFor()`; stockpile urgency on collect pin ([`CollectPinOverlay`](../src/ui/menu/CollectPinOverlay.tsx), [`stockpileState.ts`](../src/render/stockpileState.ts)).
- **Per-barracks training queues + tray countdowns.** (#5, #16) Resolved 2026-07-23 — one queue per barracks (any unit type); training speed scales with that barracks's level; legacy global queues migrate on load; notification tray shows per-barracks training timers. **Refs:** [`src/engine/barracks.ts`](../src/engine/barracks.ts), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx).
- **Structure integrity — damaged/build-timer gates.** (#1, #3, #8) Resolved 2026-07-23 — `isStructureActive` treats `buildStartedAt: 0` as under construction (`== null`, not falsy); extraction tiles and docks yield nothing while building; per-barracks training pauses when damaged or under construction (`advanceBarracksTraining`); training UI and handlers gated via `isStructureActive` / `barracksForTraining`. **Refs:** [`src/engine/formulas.ts`](../src/engine/formulas.ts), [`src/engine/tick.ts`](../src/engine/tick.ts), [`src/engine/barracks.ts`](../src/engine/barracks.ts), [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx).
- **Scout skiffs stuck at home dock.** (#6) Resolved 2026-07-23 — movement/build gate uses `buildStartedAt != null` (matches `isStructureActive`); tick build-completion aligned. **Refs:** [`src/engine/scoutSkiffs.ts`](../src/engine/scoutSkiffs.ts), [`src/App.tsx`](../src/App.tsx).
- **Recalled garrison cannot join expeditions.** (#9) Resolved 2026-07-23 — `clampPartyDispatch()` on expedition/den/lab handlers; stale dispatch stepper values no longer fail while garrison clamp succeeds. **Refs:** [`src/engine/garrisons.ts`](../src/engine/garrisons.ts), [`src/App.tsx`](../src/App.tsx).
- **Only one build/upgrade action per structure at a time.** (#4) Resolved 2026-07-23 — base level upgrade, reinforcement upgrade, and reinforcement repair share one `BaseRecord.action` slot (walls pattern); legacy `upgrade`/`reinforcementAction` fields migrate on load; handlers re-check busy state inside functional `setBoot`. **Refs:** [`src/data/base.ts`](../src/data/base.ts), [`src/engine/base.ts`](../src/engine/base.ts).
- **Base not centered after page refresh.** (#15) Resolved 2026-07-23 — defer initial center until ResizeObserver reports container size; shared `centerPanOnBase()` with `recenterOnBase()`. **Refs:** [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx).
- **Can't reclaim tile with horde-captured structure.** (#17) Resolved 2026-07-24 — unowned tiles with damaged structures show **Scout** / **Send expedition** first; repair/upgrade only when owned again (`unownedClaimActionsFor`, structure branches gated on `isOwned` in `GameScreen.tsx`). **Refs:** [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx).

</details>

---

## Questions & thoughts

### Open questions

- **Should extraction tiles run dry?** (#2) Finite pool per tier that depletes and stops yielding, vs yielding forever. **Linked to #P11:** tile **level markers** on each hex should drive stash pool size now and may become the shared basis for finite food/wood/stone pools later. Needs design pass on tier upgrades, storage, and auto-flow assumptions. **Refs:** [DESIGN.md §3](DESIGN.md), [ScrapperEconomy.md](ScrapperEconomy.md), [TWEAKS.md § Extraction Tiles](TWEAKS.md).

<details>
<summary><strong>Deferred / out of scope</strong></summary>

- **Multiplayer / PvP** — retired concept. **Refs:** [DESIGN.md §15](DESIGN.md).
- **Trade caravan (#P4)** — retired. Outposts path into the **same shared stockpile** as the main base (`engine/tick.ts`); no separate outpost storage to bridge. Was deferred when outposts had self-contained economies; moot after the unified-economy decision (see [PLAYER_GUIDE.md § Dens & outposts](PLAYER_GUIDE.md)).
- **Environmental map events** — not planned for current build.
- **Auto-repair skill for walls** — mentioned as future possibility in [DESIGN.md §15](DESIGN.md).

*(Admin tweaks GUI, water transport, and similar items with clearer direction live under [Proposed features](#proposed-features) instead.)*

</details>

<details>
<summary><strong>Ideas</strong></summary>

*(Empty — see [#P11 Scrapper & scrap stashes](#scrapper-unit--scrap-stashes-p11) in Proposed features.)*

</details>

---

## Proposed features

Features past the Ideas/Questions stage but not yet scheduled as a Milestone. **Short descriptions only** — structured specs belong in `design/MilestoneN.md` after promotion.

### Admin tweaks GUI (#P1)

In-browser visual editor for balance values; zip import/export of profile folders for deploy. Large scope — likely its own milestone when scheduled. **Refs:** [DESIGN.md §15](DESIGN.md), [TWEAKS.md § Difficulty profiles](TWEAKS.md). **Next step:** design pass on editor scope and security model.

### Watchtower intel & alerts (#P3)

Towers gain a distinct intel/alert role: passive lab-clue rolls on tick and horde-approach notifications. Tweak keys exist in schema but have no engine reader. **Refs:** [DESIGN.md §11](DESIGN.md), [Milestone 15 gap](#milestone-15--hidden-lab--win-condition--️-partial), `lab_clues.passive_surfacing.*` in tweaks. **Next step:** promote to milestone or extend M15/M16.

### Touch structure stats (#P5)

Mobile-friendly equivalent of the M20 desktop hover tooltip; Info hex is a partial fallback today. Base tile sheet **Info** tab now covers base status ([#15](#bugs--testing-feedback)); other structures still need a touch equivalent. **Refs:** [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx), Milestone 20. **Next step:** UX sketch for touch/long-press vs persistent panel.

### Water resource transport (#P6)

Path-style automation across water bodies, beyond each dock depositing directly to base storage. **Refs:** [DESIGN.md §15](DESIGN.md), [TWEAKS.md § Infrastructure Paths](TWEAKS.md). **Next step:** reconcile with dock model in [DESIGN.md §16](DESIGN.md).

### PWA install screenshots (#P7)

Add manifest `screenshots` entries (wide + mobile) for Chrome's richer install prompt. **Refs:** [Milestone 16](#milestone-16--ui-polish-pass--️-partial), `vite.config.ts` PWA plugin. **Next step:** capture screenshots and add to manifest.

### Per-tick horde tile combat (#P9)

Hordes attrition against walls/towers over time on a tile, replacing the current one-shot resolution for tile fights. **Refs:** [TWEAKS.md § Horde System](TWEAKS.md). **Next step:** design pass on combat loop vs performance.

### Terrain tile defense (#P10)

Terrain type multiplies tile claim difficulty (e.g. mountains harder than grassland), on top of distance-based defense. **Refs:** [TWEAKS.md § Territory Expansion](TWEAKS.md), [DESIGN.md §6](DESIGN.md). **Next step:** tuning table in tweaks.

### Scrapper unit & scrap stashes (#P11)

Replace passive **steel extraction tiles** with a logistics loop (see [ScrapperEconomy.md](ScrapperEconomy.md)). Includes **expedition travel parity** — mid-route retarget rules aligned with Scrapper hauls. **Decision (Q1):** steel extraction tiles removed entirely; tune early steel costs in tweaks. **Detail:** [ScrapperEconomy.md](ScrapperEconomy.md).

### Terrain art replacement (#P12)

**Status:** ✅ Done (2026-07-23). Replaced the itch.io hex basic-set terrain pack in `profiles/default/assets/terrain/` (`grassland`, `forest`, `mountain`, `shore`, `water`) with a new flat pointy-top hex set, converted to the 256×384 footprint layout via [`scripts/convert-flat-terrain-hex.py`](../scripts/convert-flat-terrain-hex.py). Profile override → default → flat-colour path unchanged. **Refs:** [attribution.md](attribution.md), [AGENTS.md](../AGENTS.md), [`src/render/tileTextures.ts`](../src/render/tileTextures.ts). **Maintenance:** future terrain swaps still need the convert script (flat hex + transparent bg → footprint); fill in source/license in attribution when confirmed.

### Per-level structure sprites (#P13)

Distinct map (and UI) art per upgrade level/tier for structures that today share one sprite — extraction small→mid→large, towers L1–4, barracks L1–4, base levels, docks/boats where it reads, etc. Walls and paths already ship tier sprites; extend that pattern with missing-file fallback to the unlevelled/default asset. **Refs:** [DESIGN.md §17](DESIGN.md), [TWEAKS.md § Difficulty profiles](TWEAKS.md), [`src/render/assetPaths.ts`](../src/render/assetPaths.ts), [`src/render/HexCanvas.tsx`](../src/render/HexCanvas.tsx), Milestone 23. **Next step:** naming convention + which structures get unique art vs shared fallback; then promote to milestone when asset set is ready.

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

*Related art tracks (not M16 scope):* [#P13](#per-level-structure-sprites-p13); terrain pack swap shipped as [#P12](#terrain-art-replacement-p12).

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

**Testable outcome:** clear den through hold → outpost as a second hub (shared stockpile for extraction + reinforcement); outpost loss reverts to den.

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

URL slugs, bundled `public/profiles/{slug}/`, partial sprite overrides with default fallback, profile persisted in save. Shipped **Standard** (`default`) and **Hard** (`hard`) sibling packs; onboarding difficulty dropdown + `/{slug}` URL. Resolves proposed **#P8** — adding more profiles (e.g. casual, speedrun) is content authoring via the same layout, not a separate feature.

**Testable outcome:** `/hard` loads hard profile; continue prompt on reload; `profiles/index.json` lists difficulties.

*Follow-ons (not in M23 scope):* per-level structure sprites [#P13](#per-level-structure-sprites-p13). Terrain art replacement shipped as [#P12](#terrain-art-replacement-p12).

</details>

</details>
