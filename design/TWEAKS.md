# Hex World — TWEAKS.md

This is the plain-English companion to `tweaks.jsonc`. Read this when you've forgotten why a number is what it is, or how a formula is supposed to work.

The canonical **Standard** balance lives at `public/profiles/default/tweaks.jsonc`. A legacy copy at `public/tweaks.jsonc` is kept in sync for reference; the app loads per-profile files at boot (see `src/data/tweaksLoader.ts`).

---

## Difficulty profiles

Each shipped difficulty is a folder under `public/profiles/{slug}/`:

```
public/profiles/
  index.json              # registry: slug, display name, description
  default/
    tweaks.jsonc          # Standard balance (meta.slug must match folder)
    assets/               # full default sprite pack (terrain, buildings, units, …)
  hard/
    tweaks.jsonc          # tighter economy / faster hordes (example)
    assets/               # optional partial overrides only — missing files fall back to default
```

**How the app picks a profile:**
- URL path on the game domain: `play.{domain}/{slug}` (e.g. `/hard`). Root `/` uses `default`.
- Onboarding **Show Advanced Options** (collapsed by default): difficulty dropdown, map size (48/96/128), seed + recent seeds — unless the profile locks them (see **Game / world** below).
- `profileSlug` is persisted in IndexedDB with the save; continue/resume uses the saved profile.

**Asset resolution** (`src/render/assetPaths.ts`): try `profiles/{active}/assets/…` → `profiles/default/assets/…` → flat-colour fallback.

**Adding a profile:** create the folder, set `meta.slug` in `tweaks.jsonc` to match, register in `index.json`, add any partial `assets/`. Zip import/export for new profiles is deferred to a future admin tweaks GUI.

---

## How to read `tweaks.jsonc`

It's **JSONC** (JSON with `//` comments). Regular `JSON.parse()` chokes on comments, so either:
- strip comments before parsing (`strip-json-comments` npm package), or
- use a JSON5 parser instead.

Every profile file uses the **same schema** — difficulty is just different numbers (and optional art) in sibling folders, not a separate format.

### Game / world (`game` block)

| Key | Role |
|-----|------|
| `grid_size` | Reference width for balance tuning (128). Also the **forced** map size when `grid_size_locked` is true. |
| `grid_size_locked` | Optional. When `true`, onboarding map-size choice is ignored — use `grid_size` for authored scenarios. |
| `world_seed` | Optional. When set, onboarding seed is ignored — fixed seed for authored scenarios. |
| `tick_interval_seconds` | Engine tick interval. |
| `resource_accumulation_precision_seconds` | Sub-tick accrual precision. |

Player-chosen map size (when not locked) is stored on the save as `WorldRecord.gridSize`; den count and placement distances scale from the 128 reference via `src/data/mapSize.ts`.

---

## The Two Universal Formulas

Almost every cost in the game uses one of these two patterns. Once you know which one applies, you can predict any number in the game.

### Formula A — "Build Count Scaling"
**Used for:** building multiple of the *same physical structure* (your 2nd tower, your 3rd wood wall, your 5th food farm, etc.)

```
cost_1 = base_cost
cost_n = cost_(n-1) × (1.0 + 0.1 × (n-1))     for n ≥ 2
```

Example — towers (base 300 wood + 150 stone):
| Tower # | Multiplier | Cost |
|---|---|---|
| 1st | ×1.0 | 300 wood + 150 stone |
| 2nd | ×1.1 | 330 wood + 165 stone |
| 3rd | ×1.2 | 396 wood + 198 stone |

**Why:** stops players from spamming one structure type infinitely cheaply. Each additional one is a bigger commitment.

**Exception — walls and docks:** both use a *linear* variant instead, `cost_n = base_cost × (1.0 + 0.1 × (n-1))` (same 10%-per-structure rate, but always against the base cost rather than compounding onto the previous one's already-scaled cost). Formula A's full compounding pushed an 8th wall to ~10x base cost and a 13th dock to ~62,000 wood (CORRECTION, 2026-07-21 playtesting feedback: "60k wood for one dock") — directly undermining `walls.slot_cost` (dense wall lines) and just making docks unaffordable past a handful. See `engine/formulas.ts:linearBuildCost`.

**Exception — goat tracks:** flat cost, no build-count scaling at all — `cost_n = base_cost`, every time. CORRECTION (2026-07-21, playtesting feedback): even the linear variant above still fought `infrastructure_paths.slot_cost`'s whole point (long connected path chains, built in bulk, are meant to be cheap) — see Infrastructure Paths, below.

### Formula B — "Tier Upgrade Scaling"
**Used for:** levelling up *one existing structure* (a tower going L1→L2, a wall going wood→rock, a storage skill going up a level, base level, base reinforcement).

```
cost(target_level) = (base_cost × 0.5) × (1.0 + 0.1 × target_level)
```

Example — tower upgrade (base 150 wood + 75 stone):
| Upgrade | Target Level | Cost |
|---|---|---|
| L1→L2 | 2 | (150×0.5)×1.2 = 90 wood, (75×0.5)×1.2 = 45 stone |
| L2→L3 | 3 | (150×0.5)×1.3 = 97.5 wood, (75×0.5)×1.3 = 48.75 stone |

**Why:** upgrading is cheaper than building new (you're improving, not duplicating), but still gets progressively pricier — and richer in resource variety — the deeper you go.

### The Technology Progression (stacks with Formula B)
Every upgrade path — towers, walls, extraction tiles, infrastructure paths — follows the same resource *unlock* order as it tiers up:

```
Tier 1 → Tier 2:  adds nothing new (same resource as base)
Tier 2 → Tier 3:  adds the next resource up the chain
Tier 3 → Tier 4:  adds the one after that
```

The chain is generally: **wood → stone → steel → power**, except infrastructure paths, which use **food → stone → steel** (since paths are "fed," not built).

This means a late-tier upgrade always costs a bit of everything you've unlocked so far — it's not just "more of the same," it's "your whole economy chipping in."

---

## Resources

Five types, in ascending rarity: **food, wood, stone, steel, power**.

Rarity determines two things:
1. **Extraction yield** — common resources (food, wood) generate more per tick than rare ones (steel, power).
2. **Noise** — rarer resources are noisier to gather. Steel and power mining/generation will attract hordes faster than farming.

**Starting amounts (first pass, untested):** food 100, wood 500, stone 400, steel 0, power 0. Sized so a fresh player can build exactly one food tile (150 wood), one wood tile (150 wood), and one stone tile (195 stone), each with a healthy buffer left over — per DESIGN.md §6. Revisit once there's a playable loop to test against.

---

## Extraction Tiles

Each resource has 3 tiers: **small → mid → large**.

**Yield formula:**
```
yield(tier) = small_yield × 1.5^(tier_index)
```
So mid = 1.5× small, large = 2.25× small (1.5²). This is Formula-independent — it's its own exponential curve, chosen deliberately to reward tiering up (rather than the flatter multiplier used for costs).

**L1 (small tier) yields per tick:**
| Resource | Yield/tick |
|---|---|
| Food | 22 |
| Wood | 18 |
| Stone | 9 |
| Steel | 5 |
| Power | 5 |

CORRECTION (2026-07-23, ROADMAP.md Milestone 21 UX #12, playtesting feedback: early game pacing too slow) — raised ~50% across the board from the original 15/12/6/3/3, alongside a 1-minute cut to every build/upgrade timer in the file (see the relevant sections below).

**Build cost:** Formula A (each additional tile of that type built costs more). Food/wood/stone cost their own resource (or wood, for food) — bootstrappable from starting resources. **Steel and power build costs were fixed from an earlier pass**: they used to cost steel and power respectively, which is unbuildable from a 0 starting balance with no other way to earn either resource first. Now: steel tile = wood + stone; power tile = wood + stone + steel (needs an established steel operation first). Tier upgrades stay self-referential (steel tiles upgrade using steel, etc.) since by then the tile is already producing that resource to reinvest. First pass, untested.
**Tier upgrade cost (small→mid→large):** Formula B, plus the tech progression (mid tier adds stone; large tier adds stone + steel).

**Noise:** two kinds —
- *Passive*, ongoing while the tile operates (e.g. food: +2 noise/min, steel: +12 noise/min)
- *One-time*, when built (+20) or upgraded (+10)

---

## Transition Tiles

Procedurally generated where two terrain types meet (e.g. grassland bordering mountain). Not a distinct terrain type — just a side-effect of what's next to what.

- Scouting one gives a cryptic hint only ("doesn't quite feel right… something in between") — the game never explains the mechanic outright.
- Either terrain's structure can be built there, but yield is **halved**. The UI just shows the reduced number — no explicit "penalty applied" messaging.

---

## Docks & Water Units

Added during playtesting — not in the original design pass, see `DESIGN.md` §16. The one exception to "nothing builds on water."

**Dock:**
- **Placement:** a water tile bordering land (`engine/terrain.ts:isTransitionTile` true on a water coord), and the water tile itself must be owned **or** scouted — not full ownership like every other structure, since ordinary land-adjacency territory growth never reaches open water on its own.
- **Build cost:** Linear build-count scaling, not Formula A (200 wood base) — `cost_n = 200 × (1 + 0.1×(n-1))`. CORRECTION (2026-07-21, playtesting feedback: "60k wood for one dock" — Formula A's compounding pushed a 13th dock to ~62,000 wood) — switched to the same linear scaling walls/goat tracks already use, same reasoning as the walls exception above.
- **Build time:** 2-minute construction timer (`dockBuildDurationMs`, `engine/docks.ts`) — CORRECTION (2026-07-21, playtesting feedback): docks previously had no construction timer at all, unlike every other structure; a dock now yields nothing until this timer elapses, same "under construction" treatment as a tower/wall/barracks. Lowered from 3 (2026-07-23 pacing pass, ROADMAP.md Milestone 21 UX #12).
- **Yield:** `yield_multiplier_vs_food_tile` (0.7) × the food extraction tile's own small-tier rate — so a dock without a fishing boat produces 70% of a small food tile's yield. Deliberately **not** also halved by the transition-tile rule (Extraction Tiles/Transition Tiles, above) — a dock sits on transition water by definition, so 0.7× is already its full intended rate.
- **No path connection:** deposits straight into base food storage every tick (capped by the storage skill, same as anywhere else) — paths can't cross water, so there's no "connected vs. unconnected" state the way a land extraction tile has. No tiers either.
- **No `damaged` state:** immune to horde capture (hordes can't reach water tiles), so it never needs repair.
- **Noise:** build 20 (`build_dock`, same weight as an extraction tile or wall).

**Fishing Boat (per dock):**
- One-time build, capped at one per dock: 150 wood + 20 steel, 3-minute timer (same shape as a tier upgrade; lowered from 4, 2026-07-23 pacing pass, ROADMAP.md Milestone 21 UX #12).
- Effect: multiplies that dock's yield by `yield_bonus_multiplier` (1.5) once complete — a fishing-boat'd dock nets 0.7 × 1.5 = 1.05× a small food tile's rate.
- Noise: build 10 (`build_fishing_boat`).

**Scout Skiff (per dock, water-side scouting):**
- Capped at `max_per_dock` (1) per dock: 240 wood + 80 food, 9-minute timer (lowered from 10, 2026-07-23 pacing pass). Doubled from 120 wood + 40 food and given a build timer (2026-07-20 balance pass, playtesting feedback: free/instant unlimited map reveal from a single cheap build was reasonably overpowered).
- Moves one tile per `seconds_per_step` (10s), always onto a water tile, excluding the tile it just left whenever another option exists (so it doesn't just oscillate between two tiles) — otherwise unconfined, free to wander anywhere in its connected body of water. Doesn't move (or scout) until its build timer completes.
- Reveals every tile it steps onto, the same `scoutedTiles` mechanism manual land scouting uses — but automatic and ongoing instead of one reveal per unit spent.
- Noise: build 5 (`build_scout_skiff`).

**Wandering Scout (land counterpart, trained at a Barracks):**
- Capped at `units.wandering_scout.max_per_barracks` (1) per barracks. Costs `scout_cost` (10) regular scouts retired from the stockpile **plus** a resource cost (150 wood + 75 stone) and a 9-minute build timer (lowered from 10, 2026-07-23 pacing pass) — added 2026-07-20 balance pass, same overpowered-for-its-cost reasoning as the Scout Skiff (previously scouts-only, no resource price, instant).
- Same movement rule as the Scout Skiff (one tile per `seconds_per_step`, excludes its last tile when another option exists), except confined to non-water terrain instead of water. Doesn't move (or scout) until its build timer completes. Moves twice as fast as the Scout Skiff — `seconds_per_step` halved from 10s to 5s (2026-07-21 playtest pass: felt static next to the skiff) — every other stat (cost, cap, build timer) is identical between the two.
- Noise: build 8 (`build_wandering_scout`).

---

## Towers

Deal damage to hordes at range, per tick, for as long as the horde is within range.

- **Base range:** 2 tiles at L1. Each level adds +1 tile of range.
- **Base damage:** 5 at L1.
- **Damage scaling:** cumulative — `dmg(L) = dmg(L-1) × (1.0 + 0.1×L)`. Same shape as Formula A/B but applied to a combat stat rather than a cost.
- **Damage vs horde formula:** `zombies_killed_per_tick = tower_damage × (horde_size / 100)` — meaning towers are *proportionally* more effective against bigger hordes in raw kill count, but a bigger horde still overwhelms faster in relative terms.
- **Garrison bonus:** militia stationed on a tower's own tile add their attack power straight onto that tower's damage before the horde-size scaling above — `garrison_damage_bonus_per_militia` (2 per militia, mirroring `units.militia.attack_per_unit`), additive, not a separate attack. A tower with 5 militia garrisoned effectively fights as if `tower_damage` were 10 higher. First pass, untested.
- **Build cost:** Formula A (300 wood + 150 stone base).
- **Upgrade cost:** Formula B (150 wood + 75 stone base), tech progression: L1→L2 (wood+stone), L2→L3 (+steel), L3→L4 (+power). The steel/power amounts had no base of their own anywhere in the original design — resolved the same way as every other tech-progression gap in this project: reuse that resource's own extraction-tile upgrade base (steel: 254, power: 330) as the baseline, then apply Formula B.
- **Build noise:** 25 (`build_tower`). **Upgrade noise:** no dedicated value existed — reuses `upgrade_extraction_tile` (10) as a generic "any structure tier-up" noise, since upgrade noise doesn't intuitively vary much by structure type. First pass, untested.

---

## Walls

Absorb horde damage via durability rather than dealing damage themselves. Cannot occupy the same tile as a tower (but a tower's range can cover a wall on an adjacent tile) — and, like every other structure, exclusive with extraction tiles and paths on that tile too.

**Tiers:** wood → rock → steel (upgrade path, not separate builds).

**Durability (hits to fully break) — descriptive reference, not the live combat number:**
| Tier | Hits to break |
|---|---|
| Wood | 3 |
| Rock | 7 |
| Steel | 15 |

**Actual damage-per-tick formula** (this is what really drives wall destruction, the "hits to break" above is just flavor/reference):
```
damage_per_tick = wall_base_damage × (horde_size / 100)
```
| Tier | Base damage |
|---|---|
| Wood | 3 |
| Rock | 7 |
| Steel | 11 |

**Max durability (HP), derived — first pass, untested:** the "hits to break" table above was explicitly flagged as flavor-only, not a live number, so an actual HP pool is derived from existing data: `maxDurability = hits_to_break × that tier's own damage_taken_base_per_tier` ("this many ticks of a horde hitting for its own base damage would break it").
| Tier | Max HP |
|---|---|
| Wood | 3 × 3 = 9 |
| Rock | 7 × 7 = 49 |
| Steel | 15 × 11 = 165 |

**Build cost:** Linear build-count scaling, not Formula A (200 wood base for the wood tier) — `cost_n = 200 × (1 + 0.1×(n-1))`. Wall #8, for example, costs 340 wood, not the ~1960 wood Formula A's compounding would produce. Changed 2026-07-20 (playtesting feedback) specifically because Formula A's compounding was at odds with `walls.slot_cost` existing to make dense wall lines viable.
**Tier upgrade cost:** Formula B, tech progression wood→rock (+stone), rock→steel (+steel) — same reused-baseline resolution as towers, above.
**Build noise:** no dedicated value existed (only `repair_wall` did) — added `build_wall: 20`, matching an extraction tile's build noise. **Upgrade noise:** reuses `upgrade_extraction_tile` (10), same as towers. First pass, untested.

**Repair:**
- Peacetime only — can't repair mid-siege (no hordes exist yet as of Milestone 8, so it's always peacetime for now; the gate becomes meaningful once Milestone 11 adds hordes).
- Repairing generates noise (+15).
- Cost is proportional to damage taken, and includes *every tier up to the wall's current tier* (repairing a steel wall costs wood + stone + steel, not just steel) — implemented by scaling the wall's own cumulative lifetime investment by the fraction of HP missing, since that investment already includes every tier's contribution by construction.

---

## Barracks & Units

A tile-based structure (exclusive with extraction tiles, paths, towers, and walls — same one-structure-per-hex rule as everything else), levels 1–4 like towers. Trains the two unit types needed for scouting and combat.

**Build cost:** Formula A (250 wood + 150 stone base for the first barracks; each additional barracks costs more).
**Upgrade cost:** Formula B (150 wood + 75 stone base), tech progression L1→L2 (wood+stone), L2→L3 (+steel), L3→L4 (+power) — same reused-baseline resolution as towers and walls, above.

**Capacity:** each barracks contributes `militia_capacity_per_level` (5) and `scout_capacity_per_level` (3), each multiplied by *that barracks' own level*, to a shared player-wide pool. Multiple barracks stack — a single L1 barracks supports 5 militia and 3 stockpiled scouts; two L1 barracks support 10 and 6.

**Scouts — one-time use:**
- Trained at a barracks for a flat cost: 30 food + 20 wood. No Formula A scaling — this replaces the old design's per-scout cost that scaled with the target tile's level.
- Stockpiled up to scout capacity.
- Spending one on an unowned tile reveals it permanently — a new "scouted" fog tier, distinct from both owned and the distance-based hidden/light/heavy tiers introduced in Milestone 2. Scouting doesn't upgrade an already-owned tile's fog tier. Only tiles adjacent to owned territory or an already-scouted tile can be targeted (`engine/territory.ts:isTileScoutable`) — knowledge has to spread outward from your footprint, matching the adjacency rule attack gating uses (Territory Expansion / Tile Assault, Milestone 10), rather than letting scouts jump to arbitrary distant tiles. A scouted tile's own fog-clearing halo (§6/Milestone 10) is roll-off only — heavy/light shading, never a fully-clear plateau — identical to how an owned tile's halo behaves; only the literal owned or scouted tile itself is ever fully clear, so this doesn't become a way to "see" far ahead of your actual claimed ground. The connecting owned/scouted tile must also be **land** — there's no water-capable unit (yet), so a scout can survey the water tile at a shoreline (adjacent to land you know) but can't chain further out hop-by-hop across open water; a water tile can never itself anchor the next scout.
- Costs food upkeep even while just sitting in the stockpile, unspent: 7 food/min per stockpiled scout.

**Militia — standing army:**
- Trained at a barracks for a flat, cheaper cost: 15 food + 10 wood.
- Not consumed on use — stands indefinitely once trained, up to militia capacity.
- Upkeep: 3.5 food/min per militia, continuously, for as long as it stands.
- **Attack:** `militia_count × 2` (attack_per_unit) — this is the assault power used both to claim unowned tiles (Milestone 10) and against zombie dens (Milestone 14), resolving the previously-undefined "assault stats vs den defense" formula.
- **Defense:** `militia_count × 2` (defense_per_unit) — contributes to base last-stand defense alongside base reinforcement HP (Milestone 12).

**Upkeep and desertion:** every tick, total upkeep (stockpiled scouts + standing militia + junkyard knights + cross-bow snipers, summed) is deducted from food. If food can't cover it for that tick's elapsed time, food clamps to 0 and exactly one unit deserts — cheapest-upkeep unit preferred, else a scout. A simple first-pass penalty, not proportional to the shortfall size.

**CORRECTION (2026-07-21 balance pass, playtesting feedback):** food reserves sat permanently full at the original upkeep rates — a single small grassland food tile alone yields ~2.25 food/sec, while even a 20-30 unit standing army cost only ~0.3-0.6 food/sec total upkeep, two orders of magnitude below what one tile produces. `upkeep_food_per_min` raised roughly 10x across all four unit types: scout 1→10, militia 0.5→5, junkyard_knight 0.8→8, cross_bow_sniper 1→10 (`public/tweaks.jsonc`) — a moderate standing army's upkeep is now the same order of magnitude as a food tile or two, not negligible next to it.

**CORRECTION 2 (2026-07-21, same-day follow-up, playtesting feedback: 10x read as too aggressive in play):** walked back to roughly 7x the original rates — scout 10→7, militia 5→3.5, junkyard_knight 8→5.5, cross_bow_sniper 10→7. Still a real ongoing drain, just less punishing than the initial pass. First pass at these numbers, still subject to further tuning.

**Noise:** build noise 20 (`build_barracks`, same weight as a wall or extraction tile). Upgrade noise reuses `upgrade_extraction_tile` (10), same generic "any structure tier-up" value as towers and walls. Training a scout or militia unit makes a small amount of noise too (3 each, `train_scout`/`train_militia`) — a person joining or leaving camp, not construction. Scouting a tile generates no noise at all (it's a stealth reveal, not an action at the target site). First pass, untested.

**Wandering Scout** (also trained here, one per barracks, added during playtesting) — see Docks & Water Units, below, for its full tuning; it's grouped there alongside its water counterpart, the Scout Skiff.

---

## Territory Expansion / Tile Assault (Milestone 10)

Beyond the free starting 19 tiles (DESIGN.md §6), every other tile — adjacent to territory you already own, **and** inside the attack radius the base level has unlocked (both required, see Base Level Upgrades, above) — has to be taken by force using militia's attack stat, not claimed automatically (except via tower viewshed claim, see below). Scouted and unscouted tiles can both be attacked; scouting first is optional and reveals the tile's defense value ahead of time, extending the reveal scouting already does for terrain/resources. The player chooses how many militia to commit per attack (not an all-in gamble with the whole standing army) — losing consumes only the committed units.

- **Tile defense — locked:** `tile_defense = tile_defense_base (0) + tile_defense_per_distance (2) × distance_from_base`. `tile_defense_per_distance` deliberately equals `units.militia.attack_per_unit` (2), so "militia needed to take a tile" works out to roughly one per tile of distance — a clean first-pass starting point. Distinct from a zombie den's defense (§13, scales much higher and separately). Terrain-based scaling (e.g., mountains harder to take than grassland) was considered but deferred to a future pass — distance-only for now.
- **Resolution:** deterministic, no luck (DESIGN.md §10) — `militia_committed × attack_per_unit >= tile_defense`. Win: tile flips to owned, joins fog-of-war/connectivity like any other owned tile, no militia lost. Lose: exactly the committed militia are consumed; the tile stays unowned.
- **Noise — locked:** `attack_tile: 25`, matching `build_tower` (the loudest action) — a militia assault is about as far from stealthy as it gets.
- **Base level — now implemented (Milestone 10), not just config:** base level was previously hardcoded to 1 everywhere (`buildSlotCap` always read level 1). This milestone adds the real `BaseRecord` (level + in-progress upgrade) and the cost/timer per Base Level Upgrades above. Attack gating requires adjacency to owned territory **and** `attackableRadius` (base.ts) — closing a gap that existed since `build_slot_cap` was first added but never had a real level to read. An earlier pass gated on the ring alone, with no adjacency check; that was a leftover artifact from a prior plan, corrected here (see Base Level Upgrades, below, and DESIGN.md §6).
- **Scope note:** distinct from horde tile combat (Milestone 11, horde vs. whatever occupies a tile) and den assault (Milestone 14, militia vs. den defense) — those reuse the same deterministic-resolution pattern this section establishes, but this one covers claiming ordinary unowned map tiles.
- **Superseded by expeditions (undocumented at the time — see `ROADMAP.md` Milestone 10):** the single-tile attack described above was later generalized into a routed, multi-tile **expedition** (`engine/expeditions.ts`, `App.tsx:handleDispatchExpedition`) — a party can claim several tiles in one trip instead of one adjacent hop at a time. `engine/territory.ts:isTileAttackable`, `GameScreen.attackOptionFor`, and `App.handleAttackTile` — all three named in earlier drafts of this doc — no longer exist; `findBestExpeditionRoute`/`resolveExpeditionWalk` and `GameScreen.expeditionRouteOptionFor` do the equivalent job now.
- **Tower viewshed claim — added post-Milestone 11 (playtesting pass):** `engine/territory.ts:autoClaimTowerRange` — every non-damaged tower automatically owns any unowned tile within its current `towerRange` (§10/Towers above; grows with level), no militia or attack required. This runs every tick, unioned with whatever force-based expansion already achieved, and excludes any tile a horde currently occupies (`hordeOccupiedKeys` in App.tsx's tick loop) so a capture can't be instantly reversed by a tower that happens to cover the same ground — the tile reclaims itself automatically the moment the horde is gone, but the structure on it (if any) stays `damaged` until separately repaired (§12). No noise or resource cost — it's a passive side effect of the tower already standing (and having already paid its own build/upgrade noise).

---

## Demolish

Works the same way across every structure type — extraction tile, path, tower, wall, barracks, or dock.

- **Refund:** a fixed 60% of everything ever spent on the structure (every build + every upgrade + every wall repair), deterministic, no luck. ROADMAP.md already named this figure; it just hadn't been added to `tweaks.jsonc` until now.
- Refunded resources are capped at whatever room is left in storage, same as any other resource gain.
- No noise generated (not specified anywhere as a noise-triggering action, unlike build/upgrade/repair).

---

## Infrastructure Paths

Automate resource transport from a claimed extraction tile back to base. **Entirely optional** — manual collection (free, player-initiated, no path tile needed) always works, just without automation.

**Tiers:** manual → goat track → stone road → highway.

- **Goat track:** a worn dirt path. Costs **food**, not building materials — you're feeding the people walking it, not paying for construction. Flat cost: 100 food, every time — **no build-count scaling at all**, not even the linear variant. CORRECTION (2026-07-21, playtesting feedback): paths are meant to be built in bulk to form long connected chains (`infrastructure_paths.slot_cost` already discounts them to 0.1 of a build slot for exactly this reason) — even 10%-per-tile linear growth undermined that, making a 50-tile network cost far more than 50× the base price.
- **Stone road:** upgrade from goat track. Costs food + stone (Formula B).
- **Highway:** upgrade from stone road. Costs food + stone + steel (Formula B).

**Terrain rules:**
- Buildable on grassland, forest, mountain, shore.
- **Not buildable on water** (future feature: water-based transport, same mechanic).
- Paths through mountain tiles suffer a **-25% throughput penalty**, compounding per mountain path tile along the route.

**Transport rate (first pass, untested):** each extraction tile has its own local stockpile (capped at the same 1000 as base storage — see Storage below), which drains to base storage at a rate relative to the tile's own current yield:
- Goat track: 0.5× the tile's yield rate (slower than production for a fully-tiered tile — some manual collection still useful).
- Stone road: 2× the tile's yield rate.
- Highway: 1000× — effectively instant, bottlenecked only by the tile's own stockpile cap, per DESIGN.md §8.

**A hex can only ever be a path tile OR an extraction tile, never both** — same one-purpose-per-tile rule as towers/walls. Building one where the other already stands is rejected.

Because of that exclusivity, connectivity is **adjacency-based**, not "the resource tile has a path on it": a tile auto-drains if it's connected via a chain of path tiles to a hex adjacent to base, where "connected" means either:
- the tile itself has a neighboring hex that's part of that base-reaching path chain, **or**
- it belongs to a contiguous cluster of same-resource-type extraction tiles (adjacent to each other) where at least one member satisfies the above — connectivity propagates transitively through the whole cluster, however large, so long as every link in the chain is the same resource type.

No connection (directly or via cluster) means the stockpile just sits there (still capped at 1000) until manually collected.

---

## Storage

A tech-tree skill per resource type — **no physical building required**. Increases how much of that resource you can hold before hitting the cap.

**Capacity formula:** doubles per level.
```
capacity(L) = capacity(L-1) × 2
```
Starting at 1000 for L1. This same 1000 baseline (not scaled by storage-skill level) also caps each extraction tile's own local stockpile — see Infrastructure Paths above.

**Upgrade cost:** Formula B, base costs increase with resource rarity (food cheapest, power most expensive, each pulling in resources from every tier below it):

| Resource | L1→L2 base cost |
|---|---|
| Food | 500 wood |
| Wood | 750 wood + 500 stone |
| Stone | 1,500 wood + 1,000 stone |
| Steel | 2,000 wood + 1,500 stone + 500 steel |
| Power | 2,500 wood + 2,000 stone + 1,000 steel + 500 food |

*(These were bumped 10× from an initial pass that felt too cheap — worth sanity-checking again once you're playtesting.)*

---

## Base Level Upgrades

The single biggest gate in the game — base level caps every other upgrade (generators, towers, walls, storage, everything).

- **Cost:** Formula B, base 500 food + 300 wood + 200 stone.
- **Time:** `time(targetLevel) = first_upgrade_time_minutes (9) × (1 + time_growth_per_level_pct/100 (20%)) ^ (targetLevel - 2)` — the first upgrade (L1→L2) takes exactly 9 minutes, then +20% compounding per level from there: L2→L3 = 10.8min, L3→L4 = ~13min, L4→L5 = ~15.6min, L5→L6 = ~18.7min. **Timer runs even while offline.** **CORRECTION (2026-07-20 balance pass, playtesting feedback):** replaces an earlier recursive FORMULA_B-style scale (`time(L) = time(L-1) × (1.0 + 0.1×L)`, starting at 1.2 hours) which made even the very first base upgrade take 86 minutes — longer than a full session on its own, absurd even though base upgrades are deliberately the most time-intensive progression track in the game. **CORRECTION 2 (2026-07-23, ROADMAP.md Milestone 21 UX #12, playtesting feedback: early game pacing too slow):** lowered from 10, shaving 1 minute off like every other build/upgrade timer in the file.
- **Attack radius cap:** `attackableRadius(level) = attack_radius_cap_base (10) + attack_radius_cap_per_level (10) × (level - 1)` — an outer ceiling on how far from base a tile can be attacked at all (10 rings at L1, +10 per level). This is a ceiling only, not the sole gate — a tile must also be adjacent to territory you already own to be attackable (see Territory Expansion / Tile Assault, above). It does not grant tiles for free — winning the tile fight is what actually converts an attackable tile into owned territory. Deliberately generous and fast-growing so this ceiling is rarely what actually limits play; adjacency is meant to be the real constraint, keeping expansion player-driven and exploration-friendly rather than boxed into a slow-unlocking ring schedule. **History:** an earlier pass used a stepped `ring_unlock_levels` scheme (rings unlocking at L3/L6/L9, ~1 ring every 3 levels) as the sole gate, with no adjacency requirement — a leftover artifact from a prior plan that was discussed but never reconciled into DESIGN.md, and far too tight at low levels besides. Replaced here after playtesting surfaced the mismatch.
- **Build slot cap:** a hard limit on total structures standing at once (DESIGN.md §9), separate from territory size. First pass, untested: `cap(level) = 10 + 10 × (level - 1)` — 10 slots at base L1, comfortably fitting the 3 starting extraction tiles plus early headroom, then +10 per base-level upgrade so each level unlocks room for meaningful new defenses/resources, not just a couple of slots.

---

## Base Relocation

Added during playtesting (2026-07-19) — not in the original DESIGN.md pass.

- **Gate:** base level 3+ (`base_relocation.min_base_level`).
- **Destination:** any other known (owned or scouted) tile that's dry land, in bounds, empty, and not the base's current tile.
- **Cost:** 20 wood + 20 stone + 15 food **per tile of straight-line distance** to the destination (`engine/base.ts:baseRelocationCost`) — not a pathfound route.
- **Duration:** 60 seconds **per tile of straight-line distance** (`baseRelocationDurationMs`) — a countdown, then a teleport. This is the anti-abuse mechanism: without a real time cost, relocation could be used to instantly dodge an oncoming horde. Runs even while offline, same virtual-clock-threshold pattern as a base-level upgrade.
- **Worked example:** a 2-tile defensive shuffle costs 40 wood/40 stone/30 food and takes 2 minutes; a 10-tile move to a distant strategic spot costs 200/200/150 and takes 10 minutes.
- **On completion:** `territory.base` moves to the destination; the destination joins `territory.owned` if it wasn't already. Base level, reinforcement HP/level, and any in-progress base action (level upgrade, reinforcement upgrade, or repair) carry over untouched — only the tile coordinate changes.
- No noise cost currently defined for relocating.

---

## Base Reinforcement (Durability / HP)

Separate from base *level* — this is the base tile's health pool against horde attacks.

- **L1 base HP:** 100, fixed.
- **Reinforcement upgrades:** flat **+25 HP per level**, cost via Formula B (200 wood + 100 stone base). **Timed:** `upgrade_time_minutes_base (3) × targetLevel` — L1→2 takes 3 min, L2→3 takes 6 min, same offline-safe virtual-clock pattern as a base-level upgrade (`baseReinforcementUpgradeDurationMs`). Cost is deducted upfront; the HP/level change lands when the timer completes. An upgrade also fully restores `currentHp` to the new max — so it doubles as a full repair once it finishes. **CORRECTION (2026-07-23, playtesting):** no longer instant on purchase; timers added alongside the 2026-07-23 pacing pass (lowered from 4 min base).
- **Cap:** max reinforcement level can't exceed current base level — you can't out-armor a base you haven't otherwise developed.
- **Single action slot:** only one of base level upgrade, reinforcement upgrade, or reinforcement repair can be in progress at a time — same mutual-exclusion rule as a wall's tier upgrade vs. durability repair (`BaseRecord.action`, ROADMAP #4). Base relocation is a separate timer and does not share this slot.
- **A horde reaching the base fights a one-shot battle, unlike other tiles' "halt and try again":** defense is `currentHp` + any garrison stationed at the base (same additive stacking a tower/wall gets elsewhere). If that defense beats the horde's size, **the horde is destroyed outright** — but the fight still costs `currentHp` equal to the horde's size, so repeated assaults demand repair even if none of them individually break through. If the horde's size instead beats that defense, the base is overrun and the game is lost (DESIGN.md §13) — unchanged from before. Deliberately not a gradual per-tick grind: a horde parked next to the base doesn't slowly whittle it down tick by tick, it either breaks through immediately or is wiped out immediately. First pass, untested.
- **Repair:** cost scales with the fraction of HP missing, against the same cost_base Formula B uses for reinforcement upgrades at the current reinforcement level (mirrors wall repair's missing-fraction shape). **Timed:** `missingHp × seconds_per_missing_hp (3)` — repairing from 0/100 HP at L0 takes 5 minutes. Blocked while a horde is still adjacent to the base, same reasoning as structure repair being blocked while a horde still occupies the tile. Shares the single action slot with upgrades above.

---

## Noise System

The core tension mechanic. Every action makes noise; noise attracts hordes.

**Model:** noise continuously converges toward an **ambient floor** set by your current structures — not a value that accumulates without bound, and not one that decays to zero. `floor_convergence_half_life_seconds: 30` — every 30 seconds, half the remaining gap between current noise and the floor closes (closed-form exponential, so it's correct even after being closed for hours, not just an approximation). A build/upgrade action spikes noise above the floor (see one-time action noise below); it then rolls back down to the floor in under a minute. If the floor ever drops (a structure lost later), noise settles down to meet it. Lowered from an original 90s — that made post-build/upgrade rolloff feel sluggish in playtesting. First pass, still untested at this value.

**Ambient minimum:** `noise_floor_minimum: 30` — a true lower clamp applied everywhere noise is computed (the structure-driven floor itself, the exponential convergence, and one-time action spikes), plus the value a fresh game starts at. Below this, activity is "practically silent" and goes unnoticed by hordes — a base with zero or near-zero structures never reads below it. First pass, untested.

**Display:** shown as a raw number labeled "db" (e.g. `noise: 245db`), not a percentage of the level-scaling cap — the cap growing with base level made a percentage-of-cap reading confusing (98% could mean very different absolute danger at different levels). Clicking a built extraction or path tile shows that tile's individual contribution to the ambient floor, so it's clear what's driving a high reading.

**One-time action noise (spikes above the floor):**
| Action | Noise |
|---|---|
| Build path tile | 10 |
| Repair wall | 15 |
| Build extraction tile | 20 |
| Build tower | 25 |
| Build wall | 20 |
| Build barracks | 20 |
| Upgrade extraction tile (also reused for tower/wall/barracks/base upgrades) | 10 |
| Upgrade infrastructure tile | 10 |
| Manual resource collection | 5 |
| Train scout | 3 |
| Train militia | 3 |
| Attack tile (Milestone 10) | 25 |

**Ambient floor contribution, extraction tiles (per tile, small tier):**
| Resource | Floor points |
|---|---|
| Food | 2 |
| Wood | 5 |
| Stone | 9 |
| Steel | 12 |
| Power | 15 |

**Tier scaling:** `floor_contribution(tile) = base × 3^tier_index` (small=0, mid=1, large=2) — steeper than the 1.5× yield curve on purpose. Small tier reads as "foraging for berries," large tier as "a loud, constant factory farm." First pass, untested.

**Ambient floor contribution, paths (per tile) — first pass, untested:**
| Path tier | Floor points |
|---|---|
| Goat track | 3 |
| Stone road | 8 |
| Highway | 20 |

A person walking a goat track isn't silent, but nowhere near a highway's constant traffic. Total floor = sum of every active structure's contribution, clamped at the cap.

---

## Horde System

**Spawn check:** every 30 seconds (raised from 10s in a 2026-07-16 balance pass — see tweaks.jsonc's `_spawn_check_interval_note`).
**Silent-floor gate (added 2026-07-19, per playtesting — hordes were overwhelming a fresh base before it had room to build):** at or below `no_horde_noise_threshold_db` (30 — the same value as `noise.noise_floor_minimum`, the ambient floor a base can never drop below), no den even rolls. The idea: 30dB is the game's definition of "silent," so there's deliberately nothing for a den to hear at that level.
**Base-level spawn scaling (added 2026-07-19, same pass):** the final spawn probability (after the noise/proximity/den-level formula below) is multiplied by `level_scaling_base + level_scaling_per_level × (base_level - 1)`, capped at 1.0 — `0.2` (20%) at base level 1, `+0.1` per level, reaching full strength (100%, no reduction) at level 9+. Independent of `noise.cap_per_level`'s existing indirect effect (a higher base level also raises the noise cap, which lowers `noise_pct` for the same raw noise) — this term throttles frequency directly instead.
**Spawn chance:** `(noise_pct / 100)² × proximity term × den-level term`, then scaled by the two gates above — noise stays the dominant, exponential factor; a den's distance and level modulate it, they can't trigger a spawn on their own.
**Cooldown:** minimum 12 minutes between hordes from the *same* den (per-den, not global).
**Size:** `dens.horde_size_base (4) + noise_pct^1.5 × den-level term` — exponential in noise, so loud, careless play summons hordes both more often and much bigger.
**Speed & decay — noise-scaled at spawn:** both fixed once, from the noise level at the moment the horde spawns (never re-evaluated mid-approach). Speed multiplier ranges `0.4×` (near-silent spawn) to `1.0×` (max noise, today's baseline pace); per-tile size decay (compounding) ranges `18%` (quiet) down to `2%` (loud). A quiet base's hordes crawl and mostly disperse before arriving; a loud base's hordes arrive at full pace and barely attritted — see tweaks.jsonc's `_speed_and_decay_note`.

**Pathfinding:** shortest path toward the noise source (your base), preferring grassland/forest, avoiding mountains, unable to cross water.

**Tower attrition — real, per-tick (not a placeholder):** every non-damaged tower whose range reaches a horde's current tile deals `zombiesKilledPerTick = tower_damage × (horde_size / 100)` continuously, every tick, for as long as the horde stays in range — a horde reduced to 0 is destroyed outright, whether by tower fire or ordinary distance decay. Separate from the one-shot "can this horde step onto this specific tile" check below.

**Tile combat (Milestone 11 placeholder, still one-shot):** the horde advances one tile per tick (scaled by its own speed multiplier, above). Trying to step onto a tile is a single deterministic `horde_size >= tile_defense` check — an undefended tile falls instantly; a tower/wall reuses its damage/durability stat; a garrison (mobile, engine/garrisons.ts) stacks additively on top of whichever applies. Losing that check just halts the horde in place — real per-tick wall/tower-tile attrition (as opposed to the range-based tower attrition above) is still deferred to a future pass.

**Garrisons auto-attack:** any garrison with a horde on its own tile or a directly adjacent one commits its full militia count against it automatically, every tick — no manual action. Win destroys the horde outright; lose wipes the garrison (its militia come off the standing army total too).

**Base loss condition, generalized to every live hub (DESIGN.md §13):** the base tile's fight uses `reinforcement HP + any garrison there` as its defense value, resolved the same one-shot way as any other tile. `engine/hordes.ts`'s `HordeHub` runs this exact same one-shot check against the main base *and* every live Outpost each tick (`hp + garrisonDefense` vs. the horde's size) — but only beating the **base's** defense ends the game; beating an outpost's instead reverts it to a hostile den (see Outposts, below). Hordes still only ever path toward the main base, never an outpost directly — an outpost only takes damage if it happens to sit on that route. See Base Reinforcement, below, for the base's own numbers.

**Capturing a tile:** if a horde wins a tile fight (other than the base, which can never be stripped from `owned`), the tile flips to unowned and any structure on it goes `damaged` — DESIGN.md §12:
- Any resources stored there are lost immediately.
- The structure survives but stops functioning entirely: a damaged extraction tile yields nothing (existing stockpile frozen, not drained either); a damaged path tile breaks the auto-flow chain through it, same as if no path were there; a damaged tower/wall contributes no combat value at all (neither tile defense nor per-tick range attrition).
- Reclaiming the tile (by attack, same as claiming any unowned tile) lets you repair the structure at 50% of its original build cost, instantly — see Territory Expansion / Tile Assault, below, for the reclaim mechanics and Repair, elsewhere in this doc, for the cost formula.
- A tower's own viewshed claim (Territory Expansion / Tile Assault, above) will auto-reclaim the bare *ground* the moment the horde is gone, if the tile falls within that tower's range — but the structure itself stays damaged regardless, until separately repaired.

---

## Zombie Den Siege (Milestone 14)

*First pass, untested — new system (2026-07-20).*

Den **level is fixed at world-gen and never changes** — no growth-over-time (dropped from the original plan; see DESIGN.md §13 for why). Clearing one is a two-stage siege:

1. **Assault** — dispatch militia/junkyard knights/cross-bow snipers exactly like an expedition (same attack-power math as Territory Expansion, above). Final fight is deterministic: `attackPower >= denDefense(level)`.
   - `denDefense(level) = den_defense_base (20) + den_defense_per_level (15) × (level - 1)` — a level-1 den (20) needs about 10 militia (attack_per_unit=2); steeper than `territory_expansion.tile_defense_per_distance` on purpose, so clearing a den reads as a bigger commitment than claiming an ordinary tile.
   - On success, the den coord plus `hold_owned_radius` (1) is claimed into `territory.owned` immediately — enough room to garrison the core and ring it with a tower or two before the first wave hits.
2. **Hold period** — `hold_duration_minutes: 10`. Every `wave_interval_minutes` (2) — 5 waves total over the hold — a last-stand wave rolls against `holdDefenseAt` (garrison on the den tile + damage from every non-damaged tower in range + durability of every non-damaged wall on a neighboring tile):
   - `lastStandWaveSize(level, waveIndex) = min(wave_cap (250), wave_base (12) + wave_per_level (10) × (level - 1) + wave_escalation_per_wave (8) × waveIndex)` — escalates every wave, so a static, set-and-forget defense isn't enough; the hold demands continued investment. Deliberately weaker than a full noise-scaled horde (DESIGN.md §13's "weaker last-stand defenders") — this is the den's own dying effort, not another horde.
   - **Win a wave:** hold continues, `waveIndex` increments (next wave is bigger).
   - **Lose a wave:** siege fails — reverts to a plain hostile den at its unchanged original level, and the garrison stationed there is wiped (same loss pattern as any other captured garrison).
   - **Survive the full duration:** converts to a player-owned Outpost — see below.

## Outposts (Milestone 14)

*First pass, untested — new system (2026-07-20).*

A converted den becomes a second, independent economic/defensive hub — a real base, just weaker and more exposed.

- **Starting territory:** `starting_owned_radius: 2` claimed on conversion — same radius as the main base's own starting territory (`engine/fog.ts`'s `OWNED_RADIUS`), so a fresh outpost genuinely reads as a second base, not a token foothold.
- **Reinforcement HP:** `outpostReinforcementHp(level) = base_hp (65) + hp_gain_per_level (15) × level` — deliberately weaker/cheaper than the main base's own track (100 base_hp, +25/level). **Starting level scales with the den it was cleared from:** `createOutpostFromDen` grants `reinforcementLevel = max(0, denLevel - 1)` — clearing a level-2 den hands over roughly 80 HP; a level-10 den, roughly 200 HP — a direct reward for the siege's difficulty, and deliberately **not** capped by the base-level ceiling that gates every *further* upgrade (`maxOutpostReinforcementLevel(baseLevel) = baseLevel`, same shape as the main base's cap). Upgrade/repair cost (Formula B, `cost_base: 150 wood + 75 stone`) is paid from the **shared stockpile**, same as the main base.
- **Resource economy:** extraction tiles connect to whichever hub (base or outpost) they're path-connected to; base always wins the claim first when a tile could reach either — see `engine/tick.ts` `accrueResources`. All hubs drain into the **single shared stockpile** (global storage skills). No separate outpost pool; proposed trade caravan (#P4) is retired.
- **Loss condition:** an outpost overrun by a horde does **not** end the game — `revertOutpostToDen` reverts it to a hostile den at `max(1, originalDenLevel - 1)` (a real setback, but not harder to re-clear than the original siege) and it has to be sieged again from scratch. See Horde System, above, for how `HordeHub` generalizes the base's loss-condition check to cover every live outpost too.

---

## Hidden Lab — Placement & Guardian (Milestone 15)

*First pass, untested — new system (2026-07-21).*

- **Placement:** one fixed tile, deterministic per world seed (`data/lab.ts:createLab`, same spiral-candidate-then-pick shape as `createDens`), never on water, at least `lab.min_distance_from_base` (20) tiles out — farther than any den ever spawns (`dens.min_distance_from_base` is 14), so the lab reads as the map's ultimate destination rather than something found incidentally early on.
- **Guardian:** a single static defense value (`lab.guardian_defense`, 300) — doesn't scale with anything, unlike a den's level-based defense. Securing it is an all-or-nothing fight exactly like a regular expedition or tile attack (not a den assault's proportional-attrition shape, and no siege/hold period) — win and the whole party comes home, lab secured for good; lose and the whole committed party is gone, guardian unchanged, retry any time.
- **Win condition:** securing the lab is the *entire* win condition (DESIGN.md §13) — clearing dens is never required. A player who finds and secures the lab without ever touching a den still wins. Den-clearing stays valuable for its own reasons (guaranteed clue below, outposts, economy, army size) but doesn't gate the win screen.

## Hidden Lab — Rumor/Clue System

**Total clues:** 5, fixed. Each clue is a directional hint relative to base — early clues give a coarse compass quadrant ("something calls from the north"), later clues refine that into a narrower arc. The final clue narrows the search down to a cluster roughly 6 tiles in radius — not the exact tile, so the player still has to scout that cluster manually.

**Surfacing (first pass, untested):**
- Passive: 2% chance per scout action, 0.5% × watchtower intel tier per watchtower tick.
- Guaranteed: clearing a den always awards exactly one clue.
- Stops once all 5 clues are collected.

---

## Open Items (Not Yet Locked)

1. **Terrain-based tile defense (Milestone 10)** — tile defense is currently distance-only (`territory_expansion.tile_defense_per_distance`); a terrain multiplier (mountains harder to take, etc.) was considered but deferred.

---

*Last updated alongside `tweaks.jsonc` v0.1.0 — first pass, entirely untested. Expect to revise every number here once there's a playable build to throw hordes at.*
