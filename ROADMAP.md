# Hex World — ROADMAP.md

Technical build order for the offline-first PWA described in `DESIGN.md`. Milestones are sequenced so each one produces something testable before moving on — no milestone should require the next one to exist to be verified.

Reference `DESIGN.md` for *what* each system does and *why*; reference `tweaks.jsonc` / `TWEAKS.md` for exact numbers. This document is concerned only with *build order*.

---

## Milestone 0 — Project Scaffold
- Vite + React PWA setup (service worker, manifest, offline shell caching)
- IndexedDB wrapper module (get/set/delete, schema versioning)
- Load `tweaks.jsonc` at boot (strip comments, parse, validate against expected shape)
- Basic routing: onboarding screen → game screen
- **Testable outcome:** app installs as a PWA, works fully offline, loads config without a network call

## Milestone 1 — Onboarding & Player Identity
- Name entry, RGB color picker
- Persist player record to IndexedDB (auto-save — covers refresh/crash recovery within a session, not the primary save mechanism)
- **Testable outcome:** create a player, refresh the page, player state survives

## Milestone 2 — Hex Grid Rendering
- Procedural seed → deterministic terrain generation (grassland/forest/mountain/shore/water)
- Hex coordinate system (axial or cube coords — pick one and document it in `DESIGN.md` once decided)
- Render 128×128 grid, viewport culling (don't render off-screen hexes), pan/zoom
- Fog of war rendering: owned tiles fully visible, stepped opacity for unclaimed rings, hidden beyond
- **Testable outcome:** same seed always produces the same visible map; fog shading matches §6 of DESIGN.md

## Milestone 3 — Starting Territory & Spawn
- On player creation: claim base tile + rings 1–2 (19 tiles), no claiming action, just ownership
- Assign starting resource amounts from `tweaks.jsonc`
- Tile click → popup shell (empty for now, wired up in later milestones)
- **Testable outcome:** new player owns 19 tiles outright, correct starting resources shown

## Milestone 4 — Resource Economy Core
- Extraction tile data model: type, tier, level, owner
- Real-time tick engine (10s server-equivalent tick, 1s internal accumulation precision, works correctly across app close/reopen using stored timestamps — critical for offline-first)
- Build extraction tile (small tier only first) via tile popup, cost deducted, build slot cap enforced
- Passive yield accumulation, storage cap enforcement per resource type
- **Testable outcome:** build a food tile, close the app, reopen an hour later, correct accumulated resources appear (capped at storage limit)

## Milestone 5 — Extraction Tiers & Upgrades
- Tier upgrade path (small → mid → large) using Formula B + tech progression from `tweaks.jsonc`
- Storage skill upgrades (tech-tree, no building)
- Transition tile detection (border-adjacency check at generation time) + half-yield rule + cryptic scout flavor text
- **Testable outcome:** upgrade a tile through all tiers, costs and yields match `TWEAKS.md` reference tables

## Milestone 6 — Manual Collection & Infrastructure Paths
- Manual collection action (scout-and-return, no path required)
- Path tile build/upgrade (goat track → stone road → highway), terrain restrictions, mountain throughput penalty
- Auto-flow tick: connected resource tiles push to base storage each tick without player action
- **Testable outcome:** a claimed, path-connected resource tile fills base storage without any manual clicks; a disconnected one doesn't

## Milestone 7 — Noise System
- Noise accumulator per player: passive gathering noise, one-time action noise, idle decay
- Noise display (even if just a debug number initially — real UI comes later)
- **Testable outcome:** noise rises with actions/gathering, decays when idle, matches formulas in `TWEAKS.md`

## Milestone 8 — Towers & Walls
- Tower build/upgrade (range, damage scaling per `tweaks.jsonc`)
- Wall build/upgrade (wood → rock → steel), durability tracking
- Repair mechanic (peacetime-only gate, cumulative tiered cost, noise on repair)
- Demolish (fixed 60% refund of total spend, confirmation dialog)
- **Testable outcome:** place a tower and wall, verify range/damage math against reference values, demolish and confirm refund amount

## Milestone 9 — Barracks & Units
- Barracks structure (tile-based, exclusive with other structures, levels 1–4 like towers, each level raising unit capacity — multiple barracks stack their capacity contribution)
- Scout units: trained at a barracks for a flat resource cost, stockpiled up to capacity, one-time use
- Scouting action: spend a scout unit on an unowned tile to reveal it permanently — the first real implementation of on-demand fog reveal (fog rendering has been distance-only since Milestone 2); introduces a new "scouted" fog tier distinct from both owned and hidden
- Militia units: trained at a barracks for a flat (cheap) resource cost, standing army (not consumed on use), ongoing food upkeep per tick; desert if upkeep can't be paid
- Militia attack stat: militia count × per-unit value — this becomes the assault power used against zombie dens (Milestone 14), resolving what was previously an undefined "assault stats vs den defense" formula
- Militia defense stat: militia count × per-unit value — contributes to base last-stand defense alongside base reinforcement HP (Milestone 12)
- **Testable outcome:** build a barracks, train scouts and militia, spend a scout unit to reveal a hidden tile, verify militia upkeep drains food each tick and desertion triggers when food runs out
- **Resolved (was a known regression):** scouting a tile persists to `scoutedTiles` and now visibly renders the "scouted" fog tier — the render dependency chain was already correct, and Milestone 10's fog rework (scouted tiles now also clear fog in a stepped radius around themselves, `engine/fog.ts:computeFogTiers`) touched the same code path, so this was confirmed fixed as part of that work

## Milestone 10 — Territory Expansion & Tile Assault
- Base level upgrades, implemented for the first time (previously hardcoded to level 1 everywhere, including `buildSlotCap`) — cost/timer per `TWEAKS.md`, timer persists correctly across offline gaps, pulled forward into this milestone since ring-unlock has nothing to gate without it
- Tile defense value for unowned tiles (baseline formula in `tweaks.jsonc`, distinct from zombie den defense — pending a balance pass)
- Attack/claim action: send militia at an unowned tile — scouted or unscouted — from the tile popup, choosing how many militia to commit (not an all-in gamble with the whole standing army)
- Deterministic combat resolution (militia attack power vs. tile defense, same no-luck principle as DESIGN.md §10): win claims the tile as owned territory, no militia lost; lose consumes exactly the committed militia and leaves the tile unowned
- Scouting a tile surfaces its defense value before attacking (extends Milestone 9's scouting reveal — resolves the "attack blind" gap)
- Attack gating requires **both** adjacency to owned territory (one of the 6 hex neighbors of a currently-owned tile) **and** being within the base-level attack radius ceiling (`tweaks.jsonc` `base_upgrades.attack_radius_cap_base`/`attack_radius_cap_per_level`) — the ceiling is deliberately generous and fast-growing so adjacency, not distance, is normally what governs play. (An earlier pass used the ring alone as the sole gate — a leftover artifact from a prior plan that was never reconciled with DESIGN.md §6 — corrected here after playtesting surfaced the mismatch.)
- **Testable outcome:** upgrade the base and watch a new ring become attackable; attack and win against an unowned tile inside an unlocked ring — it becomes owned, fog/connectivity update accordingly; attack and lose — the tile stays unowned and the spent militia are gone
- **Superseded, undocumented at the time:** this milestone's single-tile "attack an adjacent unowned tile" action was later generalized into the **expedition** system (`engine/expeditions.ts`, `App.tsx:handleDispatchExpedition`, `GameScreen.expeditionRouteOptionFor`) — a party can now walk a multi-tile route and claim everything along it in one commitment, not just one adjacent hop, using `findBestExpeditionRoute`/`resolveExpeditionWalk` in place of the single-check `isTileAttackable`/`attackOptionFor`/`handleAttackTile` this milestone originally named (those three no longer exist in the codebase). This change shipped without its own roadmap entry — noted here after a docs-vs-code review surfaced the drift (2026-07-20).

## Milestone 11 — Horde Spawning & Pathfinding
- Horde spawn check loop (per den, using noise + proximity formula)
- Horde size formula, spawn cooldown
- Pathfinding: shortest path to noise source, terrain weighting (prefer grassland/forest, avoid mountain, water impassable)
- Tile-by-tile advance and combat resolution against whatever occupies the destination tile — reuses the tile-fight resolution built in Milestone 10
- **Testable outcome:** trigger high noise near a den, observe a horde spawn and path realistically toward the base, engaging tiles along the way

## Milestone 12 — Tower/Wall Combat Resolution
- Tower attrition against horde per tick (damage formula from `tweaks.jsonc`)
- Wall durability damage per tick, wall break → horde continues
- Base reinforcement HP (plus militia defense stat from Milestone 9) — horde reaching base tile depletes it, 0 HP = loss condition
- **Testable outcome:** a defended chokepoint measurably slows/stops a horde; an undefended one doesn't; base HP hitting 0 ends the session correctly

## Milestone 13 — Territory Disconnection
- Connectivity check (base → owned tile reachability) triggered after any horde tile capture
- Disconnected section: resources lost immediately, buildings flagged "damaged"
- Reclaim flow: retake the severing tile, repair damaged buildings at reduced cost
- **Testable outcome:** force a horde to cut a path through owned territory, confirm the correct section is flagged disconnected and resources are zeroed, not the whole map

## Milestone 14 — Zombie Dens, Siege & Outposts
- Den placement at map generation (random level within distance-based cap tiers)
- **Scope change from the original plan:** den level growth over time was dropped during implementation — there's no in-fiction reason for a den to independently escalate on a clock (see DESIGN.md §13), so a den's level is fixed permanently at world-gen instead.
- Assault flow (`engine/dens.ts:resolveDenAssault`, `App.tsx:handleAssaultDen` — mirrors the expedition system from the superseded Milestone 6, using militia attack power from Milestone 9 and the tile-fight resolution from Milestone 10) → hold period with escalating last-stand defender waves (`resolveHoldPeriod`/`lastStandWaveSize`), defended by whatever the player actively builds/garrisons on the surrounding ring during the hold (`holdDefenseAt`) → success/failure branching
- Den → **Outpost** conversion on success (`engine/outposts.ts`, `data/outposts.ts`) — extended scope from the original plan: a converted den becomes a second, independent economic/defensive hub with its own reinforcement HP (starting strength scaled to the cleared den's level) and its own self-contained resource storage (connected extraction tiles auto-flow into it exactly like base, but the pool never merges with base's — see DESIGN.md §13/§15 for why that's deliberately one-way for now). Losing an outpost to a horde reverts it to a hostile den (one level down) rather than ending the game — `engine/hordes.ts`'s `HordeHub` generalizes the horde-combat/loss-condition check that used to be base-only into a list covering the base plus every live outpost.
- **Testable outcome:** clear a den start-to-finish including surviving the hold period while building defenses on the ring; fail a hold and confirm it reverts correctly; confirm a converted outpost's connected tiles auto-flow into its own storage without touching base's, and that losing the outpost to a horde reverts it to a den instead of ending the game

## Milestone 15 — Hidden Lab & Win Condition
- Lab tile placement (fixed, hidden from normal scouting)
- Rumor/clue surfacing via scouting/watchtowers: passive chance per scout action/watchtower tick (scaled by intel level) plus a guaranteed clue per den clear; 5 total clues, each a directional hint narrowing to a small hex cluster (see DESIGN.md §13)
- Static guardian defense at the lab tile
- Win-state check: securing the lab, alone, wins the game
- **Corrected scope (2026-07-21):** the original draft of this milestone (and an early pass of DESIGN.md §13) gated the win screen on "all dens cleared + lab secured." That was never the intent — a player who finds and secures the lab without ever touching a den still wins outright. Den-clearing stays valuable in its own right (a guaranteed clue per clear, outposts, economy, army size) but was never meant to be a win requirement, and DESIGN.md §13 has been corrected to match.
- **Testable outcome:** on a small test map, locate and secure the lab without clearing any den and confirm the win screen triggers anyway; separately, confirm clearing a den still awards its guaranteed clue and converts to an outpost as normal.

## Milestone 16 — UI Polish Pass
- 8-hex persistent stat display (bottom-right), replacing debug numbers from earlier milestones
- Tile popup refinement (intel display scaling with watchtower level, hover previews, cost-before-commit everywhere)
- Slide-out settings/help/notifications panel
- Watchtower range/intel/alert system (if not already threaded through earlier combat milestones)
- Add `screenshots` entries to the PWA manifest (one `form_factor: "wide"` for desktop, one without for mobile) to unlock Chrome's richer install UI — deferred from M0 since there was no real UI worth screenshotting yet
- Visual/art pass on the hex map: real textures for the 5 terrain types (grassland/forest/mountain/shore/water) and the transition-tile blend between them, replacing the flat placeholder fill colors from M2; proper icons for extraction tiles per resource (food/wood/stone/steel/power) and the base/home marker, replacing the placeholder colored dots and ⌂ glyph from M3-M5
- **Testable outcome:** a first-time player can understand their state and options without external explanation

## Milestone 17 — Offline Resilience & Save Files
- Stress-test long offline gaps (base upgrade timers, den siege hold periods/last-stand waves, resource accumulation across base and every live outpost, horde spawn checks, militia upkeep/desertion — all must resolve correctly on next load, not just "catch up" naively in a way that breaks balance)
- IndexedDB corruption/recovery handling for the active auto-saved session
- **Save-to-file:** serialize full game state to a downloadable JSON file, old-school style
- **Load-from-file:** file picker, parse and load a save file into the active session, replacing current state
- Defensive parsing only (validate structure so a malformed or hand-edited file doesn't crash the game) — no integrity checks, no anti-tamper. Single-player game; if someone wants to edit their save, that's entirely fine.
- **Testable outcome:** close the app for a simulated multi-hour gap, reopen, and every time-based system reflects the correct elapsed state; save to file, load that file on a fresh browser profile, confirm state matches exactly

---

## Milestone 18 — Base Relocation *(shipped out of sequence, during playtesting — not in the original DESIGN.md)*

- Move the base to any other known (owned or scouted), empty, dry-land tile — gated behind `base_relocation.min_base_level` (3).
- Cost and countdown duration both scale linearly with straight-line distance to the destination (`engine/base.ts:baseRelocationCost`/`baseRelocationDurationMs`) — not a pathfound route, since relocation doesn't march anyone through hostile ground, it's a countdown then a teleport. The countdown is the anti-abuse mechanism: without it, relocation could be used to instantly dodge an oncoming horde.
- Countdown persists across offline gaps, same virtual-clock-threshold pattern as a base-level upgrade (`engine/base.ts:isBaseRelocationComplete`).
- On completion: `territory.base` moves to the destination; the destination joins `territory.owned` if it wasn't already. Base level, reinforcement HP, and any in-progress base-level upgrade are untouched.
- **Testable outcome:** at base level 3+, relocate to a scouted-but-unowned tile a few hexes away; watch the countdown run (including across a simulated offline gap), then confirm the base moved, the old tile's structures/territory are otherwise unaffected, and the new tile is owned.

---

## Milestone 19 — Docks & Water Units *(shipped out of sequence, during playtesting — not originally planned)*

DESIGN.md §15 had listed water-based resources as explicitly out of scope; this milestone reverses that call after hands-on play surfaced the water half of the map as dead space. See `DESIGN.md` §16 for the system description and `TWEAKS.md` for the tuning reference.

- **Dock:** a food-generating building, the one exception to "nothing builds on water" — placed on a water tile bordering land, gated on owned-**or**-scouted (not full ownership, since normal land-adjacency territory growth never reaches open water) rather than requiring ownership like every other structure. Deposits straight to base storage each tick; no path connection (paths can't cross water either), no tiers, immune to horde capture.
- **Fishing Boat:** a per-dock, one-time yield upgrade (+50%), timer-gated like a tier upgrade.
- **Scout Skiff:** a mobile unit, one per dock, wandering its connected body of water forever and revealing every tile it crosses.
- **Wandering Scout:** the land counterpart, one per barracks, built by retiring regular scouts from the stockpile (not a resource cost) rather than through a new training queue.
- Also fixed alongside this work: Walls/Towers/Barracks could previously be built on water (a placement-validation gap `handleBuildExtractionTile`/`handleBuildPath` never had); horde spawn pacing was reworked (a hard "silent below 30dB" spawn gate, plus a base-level spawn-probability multiplier so a fresh base isn't immediately overwhelmed); and the "start a new game" flow was consolidated from three separate native-dialog menu entries into one modal offering replay-current-seed / new-seed / new-player.
- **Testable outcome:** build a dock on qualifying water, watch food accrue without a path; add a fishing boat and confirm the yield bump; build a scout skiff and a wandering scout and watch fog clear along their independent, unscripted routes over time.

---

## Explicitly Deferred (post-Milestone 17, not part of this roadmap)

- Difficulty profile files (`tweaks-hard.jsonc` etc.)
- Remote outposts / bidirectional resource flow
- Water-based transport of resources (a dock's own output still deposits directly, not via a path network — see Milestone 18)
- Environmental map events
- Auto-repair skill for walls
- Any multiplayer/PvP layer (retired concept — see `DESIGN.md` §15)

---

## Suggested Working Rhythm

Given the skirmish-length session design, playtesting can start meaningfully around **Milestone 12** (once towers/walls/hordes are all interacting) — that's the first point where the core tension of the game (noise → hordes → defense) is actually playable end-to-end, even without dens/lab/win-condition yet. Worth doing a balance pass on `tweaks.jsonc` at that point before continuing, since everything from Milestone 14 onward builds on top of that core loop feeling right.
