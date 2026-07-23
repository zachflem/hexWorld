# Hex World — ROADMAP.md

Technical build order for the offline-first PWA described in `DESIGN.md`. Milestones are sequenced so each one produces something testable before moving on — no milestone should require the next one to exist to be verified.

Reference `DESIGN.md` for *what* each system does and *why*; reference `tweaks.jsonc` / `TWEAKS.md` for exact numbers. This document is concerned only with *build order*.

---

## Milestone 0 — Project Scaffold — ✅ Complete
- Vite + React PWA setup (service worker, manifest, offline shell caching)
- IndexedDB wrapper module (get/set/delete, schema versioning)
- Load `tweaks.jsonc` at boot (strip comments, parse, validate against expected shape)
- Basic routing: onboarding screen → game screen
- **Testable outcome:** app installs as a PWA, works fully offline, loads config without a network call

## Milestone 1 — Onboarding & Player Identity — ✅ Complete
- Name entry, RGB color picker
- Persist player record to IndexedDB (auto-save — covers refresh/crash recovery within a session, not the primary save mechanism)
- **Testable outcome:** create a player, refresh the page, player state survives

## Milestone 2 — Hex Grid Rendering — ✅ Complete
- Procedural seed → deterministic terrain generation (grassland/forest/mountain/shore/water)
- Hex coordinate system (axial or cube coords — pick one and document it in `DESIGN.md` once decided)
- Render 128×128 grid, viewport culling (don't render off-screen hexes), pan/zoom
- Fog of war rendering: owned tiles fully visible, stepped opacity for unclaimed rings, hidden beyond
- **Testable outcome:** same seed always produces the same visible map; fog shading matches §6 of DESIGN.md

## Milestone 3 — Starting Territory & Spawn — ✅ Complete
- On player creation: claim base tile + rings 1–2 (19 tiles), no claiming action, just ownership
- Assign starting resource amounts from `tweaks.jsonc`
- Tile click → popup shell (empty for now, wired up in later milestones)
- **Testable outcome:** new player owns 19 tiles outright, correct starting resources shown

## Milestone 4 — Resource Economy Core — ✅ Complete
- Extraction tile data model: type, tier, level, owner
- Real-time tick engine (10s server-equivalent tick, 1s internal accumulation precision, works correctly across app close/reopen using stored timestamps — critical for offline-first)
- Build extraction tile (small tier only first) via tile popup, cost deducted, build slot cap enforced
- Passive yield accumulation, storage cap enforcement per resource type
- **Testable outcome:** build a food tile, close the app, reopen an hour later, correct accumulated resources appear (capped at storage limit)

## Milestone 5 — Extraction Tiers & Upgrades — ✅ Complete
- Tier upgrade path (small → mid → large) using Formula B + tech progression from `tweaks.jsonc`
- Storage skill upgrades (tech-tree, no building)
- Transition tile detection (border-adjacency check at generation time) + half-yield rule + cryptic scout flavor text
- **Testable outcome:** upgrade a tile through all tiers, costs and yields match `TWEAKS.md` reference tables

## Milestone 6 — Manual Collection & Infrastructure Paths — ✅ Complete
- Manual collection action (scout-and-return, no path required)
- Path tile build/upgrade (goat track → stone road → highway), terrain restrictions, mountain throughput penalty
- Auto-flow tick: connected resource tiles push to base storage each tick without player action
- **Testable outcome:** a claimed, path-connected resource tile fills base storage without any manual clicks; a disconnected one doesn't

## Milestone 7 — Noise System — ✅ Complete
- Noise accumulator per player: passive gathering noise, one-time action noise, idle decay
- Noise display (even if just a debug number initially — real UI comes later)
- **Testable outcome:** noise rises with actions/gathering, decays when idle, matches formulas in `TWEAKS.md`

## Milestone 8 — Towers & Walls — ✅ Complete
- Tower build/upgrade (range, damage scaling per `tweaks.jsonc`)
- Wall build/upgrade (wood → rock → steel), durability tracking
- Repair mechanic (peacetime-only gate, cumulative tiered cost, noise on repair)
- Demolish (fixed 60% refund of total spend, confirmation dialog)
- **Testable outcome:** place a tower and wall, verify range/damage math against reference values, demolish and confirm refund amount

## Milestone 9 — Barracks & Units — ✅ Complete
- Barracks structure (tile-based, exclusive with other structures, levels 1–4 like towers, each level raising unit capacity — multiple barracks stack their capacity contribution)
- Scout units: trained at a barracks for a flat resource cost, stockpiled up to capacity, one-time use
- Scouting action: spend a scout unit on an unowned tile to reveal it permanently — the first real implementation of on-demand fog reveal (fog rendering has been distance-only since Milestone 2); introduces a new "scouted" fog tier distinct from both owned and hidden
- Militia units: trained at a barracks for a flat (cheap) resource cost, standing army (not consumed on use), ongoing food upkeep per tick; desert if upkeep can't be paid
- Militia attack stat: militia count × per-unit value — this becomes the assault power used against zombie dens (Milestone 14), resolving what was previously an undefined "assault stats vs den defense" formula
- Militia defense stat: militia count × per-unit value — contributes to base last-stand defense alongside base reinforcement HP (Milestone 12)
- **Testable outcome:** build a barracks, train scouts and militia, spend a scout unit to reveal a hidden tile, verify militia upkeep drains food each tick and desertion triggers when food runs out
- **Resolved (was a known regression):** scouting a tile persists to `scoutedTiles` and now visibly renders the "scouted" fog tier — the render dependency chain was already correct, and Milestone 10's fog rework (scouted tiles now also clear fog in a stepped radius around themselves, `engine/fog.ts:computeFogTiers`) touched the same code path, so this was confirmed fixed as part of that work

## Milestone 10 — Territory Expansion & Tile Assault — ✅ Complete
- Base level upgrades, implemented for the first time (previously hardcoded to level 1 everywhere, including `buildSlotCap`) — cost/timer per `TWEAKS.md`, timer persists correctly across offline gaps, pulled forward into this milestone since ring-unlock has nothing to gate without it
- Tile defense value for unowned tiles (baseline formula in `tweaks.jsonc`, distinct from zombie den defense — pending a balance pass)
- Attack/claim action: send militia at an unowned tile — scouted or unscouted — from the tile popup, choosing how many militia to commit (not an all-in gamble with the whole standing army)
- Deterministic combat resolution (militia attack power vs. tile defense, same no-luck principle as DESIGN.md §10): win claims the tile as owned territory, no militia lost; lose consumes exactly the committed militia and leaves the tile unowned
- Scouting a tile surfaces its defense value before attacking (extends Milestone 9's scouting reveal — resolves the "attack blind" gap)
- Attack gating requires **both** adjacency to owned territory (one of the 6 hex neighbors of a currently-owned tile) **and** being within the base-level attack radius ceiling (`tweaks.jsonc` `base_upgrades.attack_radius_cap_base`/`attack_radius_cap_per_level`) — the ceiling is deliberately generous and fast-growing so adjacency, not distance, is normally what governs play. (An earlier pass used the ring alone as the sole gate — a leftover artifact from a prior plan that was never reconciled with DESIGN.md §6 — corrected here after playtesting surfaced the mismatch.)
- **Testable outcome:** upgrade the base and watch a new ring become attackable; attack and win against an unowned tile inside an unlocked ring — it becomes owned, fog/connectivity update accordingly; attack and lose — the tile stays unowned and the spent militia are gone
- **Superseded, undocumented at the time:** this milestone's single-tile "attack an adjacent unowned tile" action was later generalized into the **expedition** system (`engine/expeditions.ts`, `App.tsx:handleDispatchExpedition`, `GameScreen.expeditionRouteOptionFor`) — a party can now walk a multi-tile route and claim everything along it in one commitment, not just one adjacent hop, using `findBestExpeditionRoute`/`resolveExpeditionWalk` in place of the single-check `isTileAttackable`/`attackOptionFor`/`handleAttackTile` this milestone originally named (those three no longer exist in the codebase). This change shipped without its own roadmap entry — noted here after a docs-vs-code review surfaced the drift (2026-07-20).

## Milestone 11 — Horde Spawning & Pathfinding — ✅ Complete
- Horde spawn check loop (per den, using noise + proximity formula)
- Horde size formula, spawn cooldown
- Pathfinding: shortest path to noise source, terrain weighting (prefer grassland/forest, avoid mountain, water impassable)
- Tile-by-tile advance and combat resolution against whatever occupies the destination tile — reuses the tile-fight resolution built in Milestone 10
- **Testable outcome:** trigger high noise near a den, observe a horde spawn and path realistically toward the base, engaging tiles along the way

## Milestone 12 — Tower/Wall Combat Resolution — ✅ Complete
- Tower attrition against horde per tick (damage formula from `tweaks.jsonc`)
- Wall durability damage per tick, wall break → horde continues
- Base reinforcement HP (plus militia defense stat from Milestone 9) — horde reaching base tile depletes it, 0 HP = loss condition
- **Testable outcome:** a defended chokepoint measurably slows/stops a horde; an undefended one doesn't; base HP hitting 0 ends the session correctly

## Milestone 13 — Territory Disconnection — ✅ Complete
- Connectivity check (base → owned tile reachability) triggered after any horde tile capture
- Disconnected section: resources lost immediately, buildings flagged "damaged"
- Reclaim flow: retake the severing tile, repair damaged buildings at reduced cost
- **Testable outcome:** force a horde to cut a path through owned territory, confirm the correct section is flagged disconnected and resources are zeroed, not the whole map

## Milestone 14 — Zombie Dens, Siege & Outposts — ✅ Complete
- Den placement at map generation (random level within distance-based cap tiers)
- **Scope change from the original plan:** den level growth over time was dropped during implementation — there's no in-fiction reason for a den to independently escalate on a clock (see DESIGN.md §13), so a den's level is fixed permanently at world-gen instead.
- Assault flow (`engine/dens.ts:resolveDenAssault`, `App.tsx:handleAssaultDen` — mirrors the expedition system from the superseded Milestone 6, using militia attack power from Milestone 9 and the tile-fight resolution from Milestone 10) → hold period with escalating last-stand defender waves (`resolveHoldPeriod`/`lastStandWaveSize`), defended by whatever the player actively builds/garrisons on the surrounding ring during the hold (`holdDefenseAt`) → success/failure branching
- Den → **Outpost** conversion on success (`engine/outposts.ts`, `data/outposts.ts`) — extended scope from the original plan: a converted den becomes a second, independent economic/defensive hub with its own reinforcement HP (starting strength scaled to the cleared den's level) and its own self-contained resource storage (connected extraction tiles auto-flow into it exactly like base, but the pool never merges with base's — see DESIGN.md §13/§15 for why that's deliberately one-way for now). Losing an outpost to a horde reverts it to a hostile den (one level down) rather than ending the game — `engine/hordes.ts`'s `HordeHub` generalizes the horde-combat/loss-condition check that used to be base-only into a list covering the base plus every live outpost.
- **Testable outcome:** clear a den start-to-finish including surviving the hold period while building defenses on the ring; fail a hold and confirm it reverts correctly; confirm a converted outpost's connected tiles auto-flow into its own storage without touching base's, and that losing the outpost to a horde reverts it to a den instead of ending the game

## Milestone 15 — Hidden Lab & Win Condition — ⚠️ Mostly complete
- Lab tile placement (fixed, hidden from normal scouting)
- Rumor/clue surfacing via scouting/watchtowers: passive chance per scout action/watchtower tick (scaled by intel level) plus a guaranteed clue per den clear; 5 total clues, each a directional hint narrowing to a small hex cluster (see DESIGN.md §13)
- Static guardian defense at the lab tile
- Win-state check: securing the lab, alone, wins the game
- **Corrected scope (2026-07-21):** the original draft of this milestone (and an early pass of DESIGN.md §13) gated the win screen on "all dens cleared + lab secured." That was never the intent — a player who finds and secures the lab without ever touching a den still wins outright. Den-clearing stays valuable in its own right (a guaranteed clue per clear, outposts, economy, army size) but was never meant to be a win requirement, and DESIGN.md §13 has been corrected to match.
- **Gap found during a 2026-07-22 status review:** "passive chance per scout action/watchtower tick" only half-shipped — `rollScoutClue` (per-scout-action roll) and the guaranteed den-clear bonus are both wired up, but the watchtower-tick half never got engine code. `tweaks.jsonc`'s `lab_clues.passive_surfacing.per_watchtower_tick_base_chance`/`watchtower_intel_tier_multiplier` exist in the schema but nothing reads them — clues currently only come from scouting and den clears.
- **Testable outcome:** on a small test map, locate and secure the lab without clearing any den and confirm the win screen triggers anyway; separately, confirm clearing a den still awards its guaranteed clue and converts to an outpost as normal.

## Milestone 16 — UI Polish Pass — ⚠️ Partially complete, remainder superseded by Milestone 20
- 8-hex persistent stat display (bottom-right), replacing debug numbers from earlier milestones — **superseded:** shipped instead as the icon-led HUD resource/noise chip bar (Milestone 20)
- Tile popup refinement (intel display scaling with watchtower level, hover previews, cost-before-commit everywhere) — **superseded:** the tile popup itself was retired and replaced by the hex-ring action menu (Milestone 20); "hover previews" specifically was delivered later, via the desktop hover tooltip (Milestone 20), not the popup; "intel display scaling with watchtower level" was never built — see the Milestone 15 gap note
- Slide-out settings/help/notifications panel — ✅ done (SettingsPanel + NotificationTray, Milestone 20)
- Watchtower range/intel/alert system (if not already threaded through earlier combat milestones) — ❌ not done: towers have combat range/damage, but there's no separate intel/alert role, no horde-spawn/approach notifications, and the `watchtower_intel_tier_multiplier` tweak is unused (see Milestone 15)
- Add `screenshots` entries to the PWA manifest (one `form_factor: "wide"` for desktop, one without for mobile) to unlock Chrome's richer install UI — deferred from M0 since there was no real UI worth screenshotting yet — ❌ not done
- Visual/art pass on the hex map: real textures for the 5 terrain types (grassland/forest/mountain/shore/water) and the transition-tile blend between them, replacing the flat placeholder fill colors from M2; proper icons for extraction tiles per resource (food/wood/stone/steel/power) and the base/home marker, replacing the placeholder colored dots and ⌂ glyph from M3-M5 — ✅ done (path tile textures followed later, Milestone 20)
- **Testable outcome:** a first-time player can understand their state and options without external explanation

## Milestone 17 — Offline Resilience & Save Files — ⚠️ Partially complete
- Stress-test long offline gaps (base upgrade timers, den siege hold periods/last-stand waves, resource accumulation across base and every live outpost, horde spawn checks, militia upkeep/desertion — all must resolve correctly on next load, not just "catch up" naively in a way that breaks balance) — ✅ done
- IndexedDB corruption/recovery handling for the active auto-saved session — ✅ done
- **Save-to-file:** serialize full game state to a downloadable JSON file, old-school style — ❌ not done
- **Load-from-file:** file picker, parse and load a save file into the active session, replacing current state — ❌ not done
- Defensive parsing only (validate structure so a malformed or hand-edited file doesn't crash the game) — no integrity checks, no anti-tamper. Single-player game; if someone wants to edit their save, that's entirely fine.
- **Testable outcome:** close the app for a simulated multi-hour gap, reopen, and every time-based system reflects the correct elapsed state; save to file, load that file on a fresh browser profile, confirm state matches exactly — offline-gap half confirmed, save/load-to-file half blocked on the two ❌ items above

---

## Milestone 18 — Base Relocation — ✅ Complete *(shipped out of sequence, during playtesting — not in the original DESIGN.md)*

- Move the base to any other known (owned or scouted), empty, dry-land tile — gated behind `base_relocation.min_base_level` (3).
- Cost and countdown duration both scale linearly with straight-line distance to the destination (`engine/base.ts:baseRelocationCost`/`baseRelocationDurationMs`) — not a pathfound route, since relocation doesn't march anyone through hostile ground, it's a countdown then a teleport. The countdown is the anti-abuse mechanism: without it, relocation could be used to instantly dodge an oncoming horde.
- Countdown persists across offline gaps, same virtual-clock-threshold pattern as a base-level upgrade (`engine/base.ts:isBaseRelocationComplete`).
- On completion: `territory.base` moves to the destination; the destination joins `territory.owned` if it wasn't already. Base level, reinforcement HP, and any in-progress base-level upgrade are untouched.
- **Testable outcome:** at base level 3+, relocate to a scouted-but-unowned tile a few hexes away; watch the countdown run (including across a simulated offline gap), then confirm the base moved, the old tile's structures/territory are otherwise unaffected, and the new tile is owned.

---

## Milestone 19 — Docks & Water Units — ✅ Complete *(shipped out of sequence, during playtesting — not originally planned)*

DESIGN.md §15 had listed water-based resources as explicitly out of scope; this milestone reverses that call after hands-on play surfaced the water half of the map as dead space. See `DESIGN.md` §16 for the system description and `TWEAKS.md` for the tuning reference.

- **Dock:** a food-generating building, the one exception to "nothing builds on water" — placed on a water tile bordering land, gated on owned-**or**-scouted (not full ownership, since normal land-adjacency territory growth never reaches open water) rather than requiring ownership like every other structure. Deposits straight to base storage each tick; no path connection (paths can't cross water either), no tiers, immune to horde capture.
- **Fishing Boat:** a per-dock, one-time yield upgrade (+50%), timer-gated like a tier upgrade.
- **Scout Skiff:** a mobile unit, one per dock, wandering its connected body of water forever and revealing every tile it crosses.
- **Wandering Scout:** the land counterpart, one per barracks, built by retiring regular scouts from the stockpile (not a resource cost) rather than through a new training queue.
- Also fixed alongside this work: Walls/Towers/Barracks could previously be built on water (a placement-validation gap `handleBuildExtractionTile`/`handleBuildPath` never had); horde spawn pacing was reworked (a hard "silent below 30dB" spawn gate, plus a base-level spawn-probability multiplier so a fresh base isn't immediately overwhelmed); and the "start a new game" flow was consolidated from three separate native-dialog menu entries into one modal offering replay-current-seed / new-seed / new-player.
- **Testable outcome:** build a dock on qualifying water, watch food accrue without a path; add a fishing boat and confirm the yield bump; build a scout skiff and a wandering scout and watch fog clear along their independent, unscripted routes over time.

---

## Milestone 20 — UI Enrichment — ✅ Complete *(shipped out of sequence, during playtesting — supersedes part of Milestone 16's original UI-polish scope)*

The tile-popup-centric UI from Milestone 16 stopped scaling as more structure types and per-tile actions piled on, and read poorly at small/mobile sizes. This milestone replaced it wholesale with a hex-native UI (the map itself is hexes; the menu became hexes too) plus real textures and legible iconography in place of reused in-world sprites.

- **Phase 0-2 — Foundations, HUD re-skin, notifications** (`f303a83`): shared primitives (`Panel`, `Badge`, `StatRow`, `HexButton`, `InProgressRow`, `PartyDispatchForm`), the lucide-react icon set, and `HexCanvas` viewport plumbing (`getTileScreenPosition`/`onViewportChange`) laying the groundwork for an imperatively-positioned per-tile overlay. HUD bar rebuilt as icon-led resource chips with live per-resource deltas (`engine/resourceRates.ts`, mirrors `accrueResources` exactly). The base gained a map level-badge like every other leveled structure (previously the only one without one). Notification tray re-skinned into compact rows (adding lab assaults, previously missing entirely) plus a new one-off toast system (base upgrade complete, den cleared, lab clue found).
- **Phase 3 — Global hex cluster** (`374fdaa`): a collapsed-by-default honeycomb menu (bottom-right) that blooms into six panel slots — Garrisons, Scouting (incl. lab clue history), Military, Research, a build-mode toggle that teal-highlights owned/empty/buildable tiles with an affordable structure option, and Settings — using true hex-neighbor adjacency math so it tessellates cleanly. Replaces the old hamburger dropdown entirely.
- **Phase 4 — Hex-ring action menu** (`b5440d9`): `TilePopup` retired entirely in favor of a per-tile hex-ring menu anchored to the selected tile's own map neighbors — recursive drill-down categories (Civil/Military build choices, storage upgrades, unit training), an Info hex for passive status (auto-flow, noise floor, tower stats), and forms for garrison/expedition/den-assault/lab-secure quantities. Every build/upgrade/repair timer and base relocation moved into the notification tray as a countdown card instead of living in a per-tile popup.
- **Real path tile textures** (`b50a63a`): path tiers render their actual sprite instead of a flat tier-color fill, same full-hex-replacement convention as terrain and resource textures.
- **Marker icons for resources & noise** (`e5a957f`, `37c01b2`): the resource-type icon used in the HUD bar and every build/upgrade ring hex (extraction tiles, storage upgrades) switched from the full-size in-world sprites — illegible once shrunk to chip/ring-hex size — to purpose-built marker icons (`public/tiles/markers/`). The noise HUD indicator was simplified from a fixed-width progress bar to an icon+value chip matching the resource chips, fixing mobile layout scaling.
- **Desktop hover tooltip** (`c54dd08`): hovering any structure with a mouse shows a small floating card — type/icon, current status (under construction/damaged/repairing/upgrading/operational), and whatever stats apply (yield + connectivity for extraction tiles, range/DPS for towers, durability for walls, HP for base/outposts, defense for dens/the lab). Positioned imperatively off the same coord→screen-position resolver the action ring uses, so it tracks pan/zoom without a full re-render. Mouse-only — no touch equivalent — so the ring menu's Info hex stays in place as the touch-friendly fallback.
- **Testable outcome:** select any tile and drive its full action set through the ring menu with no popup in sight; open the honeycomb cluster and reach every panel (Garrisons/Scouting/Military/Research/build-mode/Settings); hover a structure on desktop and see status/stats that match its actual state.

---

## Milestone 21 — Stability & UX Backlog — 🚧 Not started

Playtesting backlog gathered 2026-07-22. Ordered by the user's stated priority: bugs first (they block correct play), then general UI improvements, then UX tweaks, then open design questions that need discussion before they can even become an implementation plan. Original list numbers kept in parentheses for reference in future conversations.

### Bugs
- **Barracks keeps training with no other barracks available, even while damaged.** (#1) A damaged barracks should stop producing/training the same way a damaged extraction tile stops yielding (`isStructureActive`) — the training queue needs the same gate.
- **Unit training is selectable the instant a barracks build starts**, before its build timer completes. (#3) Should stay locked until `buildStartedAt` clears, same as every other build-in-progress structure.
- **Only one build/upgrade action should be allowed per structure at a time.** (#4) e.g. the base's reinforcement-HP track and its level upgrade don't currently block each other and can run concurrently — they should share one in-progress slot, the way `Wall.action`/`BaseReinforcementAction` already force upgrade-and-repair to share a slot elsewhere.
- **Training needs to be one queue per barracks**, not shared capacity across all of them. (#5) Training two different unit types at the same time should require two separate barracks, not one barracks running two queues at once.
- **Scout skiffs get stuck at their home dock and never wander off.** (#6) Reproduced with a 5x speed multiplier active, stuck for a simulated realtime hour+.
- **Resource buildings accumulate stockpile during their own build timer.** (#8) An extraction tile shouldn't yield anything until `buildStartedAt` clears — currently yield appears to start immediately on build start instead of on completion.
- **Recalled garrison units can't be sent on an expedition afterward** (they can still be re-garrisoned). (#9) Repro: commit militia to garrison a tile against a nearby horde, recall them with zero losses, then try to dispatch an expedition. Possibly connected to a separate already-known "only one militia unit ever actually gets sent" bug — worth investigating together rather than separately.

### UI
- **Building sprite vertical alignment.** (#7) — ✅ Resolved (2026-07-23): structure icons no longer center-anchor on the hex (which left them sitting too low with empty space above). They now bottom-anchor on a shared ground line and rise upward at their natural aspect ratio so taller sprites spill into the tile above — same depth illusion terrain overlays already use (`drawHexTileOverlay` in `src/render/tileTextures.ts`). **Implementation:** `drawStructureIconAtWidth` (low-level draw, bottom-anchored) + `src/render/structurePlacement.ts` (all tuning tables and `drawPlacedStructureIcon`/`drawPlacedResourceIcon` helpers). `HexCanvas` calls those helpers for every fixed structure and extraction building; mobile/transient markers (hordes, expeditions, scouts, etc.) still use center-anchored `drawImageAtWidth`. **Tuning for devs/artists:** edit `structurePlacement.ts` only — no need to touch `HexCanvas` unless adding a brand-new structure type. `STRUCTURE_GROUND_FRACTION` (default `0.35`) sets the shared ground line as a fraction of hex radius below tile center. `STRUCTURE_VERTICAL_OFFSET` / `RESOURCE_VERTICAL_OFFSET` nudge individual sprites in the same units (negative = up, positive = down). `STRUCTURE_ICON_SCALE` / `RESOURCE_ICON_SCALE` control width; height follows each PNG's aspect ratio. Construction-in-progress uses its own `"construction"` key so the scaffold icon can be aligned separately from finished buildings. When adding a new structure type: add a `StructurePlacementKey`, set its scale/offset entries, and call `drawPlacedStructureIcon(ctx, img, x, y, size, key)` from `HexCanvas`.
- **Extraction tiles never get the orange "upgrade available" badge** other upgradeable structures get. (#13) Also add a stockpile-state color cue on the tile icon: green at 75% local stockpile, red at 100% — a visual nudge to manually collect a tile that isn't auto-flowing before it caps out and starts wasting yield. — ✅ Resolved (2026-07-23): extraction tiles are included in `upgradeAvailableKeysFor()` and get the same orange level badge as base/tower/barracks when the next tier is unlocked and affordable. Stockpile urgency is shown on the collect pin (`CollectPinOverlay` + `src/render/stockpileState.ts`) rather than a ring on the tile icon — green at ≥75% local stockpile, red at 100%; stockpile state takes priority over the pin's upgrade-orange tint.

### UX
- **Map size choice during onboarding** — 48×48 / 96×96 / 128×128. (#10) Should scale overall game pace, and needs den count (and any other density-based placement) to scale with it too, not just a straight grid resize.
- **Quick-collect icon directly on a resource building** — skip opening the ring menu just to collect. (#11)
- **Early game pacing is too slow.** (#12) — ✅ Resolved (2026-07-23): small-tier extraction yields raised ~50% (food 15→22, wood 12→18, stone 6→9, steel/power 3→5, `public/tweaks.jsonc`), and every flat build/upgrade timer in the file (extraction tiles, docks/fishing boat/scout skiff, towers, walls, barracks/wandering scout, infrastructure paths, storage, base level, base reinforcement, outpost reinforcement, research tiers) shaved down by 1 minute.
- **Toast notifications should auto-collapse.** (#14) Show fully for 5 real-time seconds, then slide out to just the action icon; clicking the icon re-expands it. The player should always be able to see, at a glance, how many upgrades/expeditions/etc. are currently in flight even after the toasts collapse.

### Questions *(need design discussion before an implementation plan)*
- **Should extraction tiles be able to run dry?** (#2) e.g. a finite pool sized by tile tier/level that depletes with production and stops yielding once exhausted, instead of yielding forever. DESIGN.md doesn't currently model finite resources — needs a design pass (interaction with tier upgrades, storage, and the existing "connected tiles auto-flow forever" assumption) before this becomes buildable work.

---

## Milestone 22 — Onboarding Overhaul: The Field Manual — 🚧 Not started

The bare form from Milestone 1 (name/colour/seed, no framing, no lore delivery) gets replaced with a short paged sequence themed as a found field manual — aged paper, not the glowing-terminal look, since the player hasn't built any power infrastructure yet when the run begins. Full implementation plan and design detail: `design/Milestone22.md`.

- **Testable outcome:** a brand-new player clicks/keys through cover → form → story pages → send-off and lands in the game with the name/colour/seed they entered; an existing save still skips onboarding entirely; the manual reads correctly in both light and dark mode.

---

## Explicitly Deferred (post-Milestone 17, not part of this roadmap)

- Difficulty profile files (`tweaks-hard.jsonc` etc.)
- Water-based transport of resources (a dock's own output still deposits directly, not via a path network — see Milestone 18)
- Environmental map events
- Auto-repair skill for walls
- Any multiplayer/PvP layer (retired concept — see `DESIGN.md` §15)

---

## Suggested Working Rhythm

Given the skirmish-length session design, playtesting can start meaningfully around **Milestone 12** (once towers/walls/hordes are all interacting) — that's the first point where the core tension of the game (noise → hordes → defense) is actually playable end-to-end, even without dens/lab/win-condition yet. Worth doing a balance pass on `tweaks.jsonc` at that point before continuing, since everything from Milestone 14 onward builds on top of that core loop feeling right.
