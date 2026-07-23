# Hex World — DESIGN.md

**Genre:** Single-player, offline-first hex strategy / base-defense
**Session shape:** One-off skirmish campaign, AoE-style — load up, play 30–90 minutes, reach an outcome (win or loss), done.
**Platform:** Offline-capable PWA (and/or standalone APK later). No server dependency, no login, no account.

Exact tunable numbers (costs, yields, formulas) live in `tweaks.jsonc` / `TWEAKS.md` — this document describes the *systems*, not the specific values.

---

## 1. Premise

A small group arrives in unfamiliar territory. They settle, and immediately claim the ground around them. Beneath the surface tension of resource management and expansion is a slow-burning threat: zombie dens scattered across the map, each a fixed, knowable danger — tougher ones further from home — spawning hordes that hunt by sound. Somewhere out there is a hidden lab holding a cure. Clear every den, secure the lab, and you win. Let a horde through your defenses at the wrong moment, and your base — and the run — is over.

---

## 2. Core Loop

**Settle → Extract → Automate → Fortify → Expand → Confront**

1. **Settle:** Choose where to place your first extraction tiles and any early defenses within your starting territory.
2. **Extract:** Resource tiles generate food, wood, stone, steel, and power passively, in real time.
3. **Automate:** Build infrastructure paths so resources flow to base without manual collection.
4. **Fortify:** Place towers and walls — strategically, since build slots are capped and you can never fully wall off.
5. **Expand:** Scout and attack tiles beyond your starting territory with militia, following clues toward zombie dens and the hidden lab.
6. **Confront:** Assault and hold zombie dens, eventually locating and securing the lab to win — or lose your base to a horde along the way.

---

## 3. The World

- **Grid:** 128×128 hexes, procedurally seeded (a seed value fully determines terrain, resources, den placement, and lab location — enables sharing/replaying seeds later, like Minecraft).
- **Coordinate system:** tiles are stored/serialized as **axial coordinates (q, r)** — simple two-integer keys, natural for save files. Algorithms that need them (distance, range queries, horde pathing line-of-travel) convert to cube coordinates internally.
- **Terrain types:** grassland, forest, mountain, shore, water — each restricts which structures can be built on it.
- **Transition tiles:** procedurally occur where two terrain types border each other. Either terrain's structures can be built there, at half yield. The game never explains this — scouting one only returns a cryptic hint.
- **Natural resource tiles:** carry a level (1–24) determining yield when interacted with, and regenerate over time if depleted.

---

## 4. Player Onboarding

No login, no email, no account. On arrival, the player finds a short **field manual** — aged paper, in-world prose, not a terminal UI — and pages through it before play begins:

1. **Cover** — title and hook.
2. **Registration** — name, full RGB colour picker, optional world seed (same validation as before: blank seed is random; otherwise a non-negative integer).
3. **Story pages** (four brief log entries) — settling the starting territory, how noise draws hordes, the rumoured hidden lab (securing it wins the run; clearing dens is valuable but not required), and a light in-fiction nudge before heading out.
4. **Send-off** — closing line, then into the game.

Returning saves skip onboarding entirely. Choosing **Start as a new player** from the new-game dialog shows the full manual again.

Progress persists locally in IndexedDB automatically during play, so closing the tab mid-session doesn't lose anything. For anything beyond that — moving a game to another device, keeping a backup, running separate playthroughs side by side — the player explicitly **saves to a file** (see §17).

---

## 5. Resources

Five types, ascending in rarity: **food → wood → stone → steel → power**. Rarity determines both extraction yield (common resources yield more) and noise generated while gathering (rarer resources are louder).

Each resource has its own **storage cap**, upgraded independently via a tech-tree skill (no physical building required) — capacity doubles per level.

---

## 6. Starting Territory

The player owns their base tile plus the first two full rings around it (19 tiles total) **immediately, with no claiming action required** — this is their camp, not conquered ground. Starting resources are set so the player can build exactly one food, one wood, and one stone extraction tile right away, with a modest buffer left over.

**Fog of war** begins exactly one ring past owned territory: the first unclaimed ring is heavily shaded (representing "known but unclear"), the next ring past that is barely visible, and everything beyond is fully hidden until scouted. Watchtowers (see §11) clear fog fully within their range; the same stepped shading resumes just beyond that range. Owned and scouted tiles are both fog-clearing centers, and both behave identically as one: each radiates the same heavy → light roll-off outward from itself, and neither one grants a fully-clear plateau bleeding onto neighbors that aren't themselves owned or scouted — only the literal owned/scouted tile itself is fully clear. This matters because a tile merely adjacent to (and attackable from) owned territory is not automatically visible: expanding your zone of full clarity still requires actually taking or scouting each tile (see below), not just standing next to it — "attack blind" has to actually mean blind. A scouted tile remains visually distinct from an owned one either way (it's knowledge, not territory), even though their halos match.

**Expanding beyond the starting 19** is mostly not automatic — the primary route is force, and only from your existing footprint outward: a tile is attackable only if it is **both** (a) adjacent to a tile you currently own, and (b) within the attack radius the base level has unlocked (a generous, fast-growing outer ceiling — meant to rarely be the actual limiter, so adjacency is what governs play, not an arbitrary distance cap; we want players free to explore and push outward in any direction). Claiming a specific attackable tile means sending militia to attack it (see §11) and winning a deterministic tile fight against that tile's defense value, the same no-luck resolution used for horde and den combat (§10). Scouted or not, any attackable tile can be targeted — scouting first is optional, but it reveals the tile's defense value ahead of time so the attack isn't blind. In the current build this is called an **expedition**: the player commits a chosen mix of militia/knights/snipers and provisions to a route that can claim several tiles in one trip, not just a single adjacent hop — a party lost mid-route (e.g. a horde cuts the road) forfeits everything committed.

**Towers also claim passively** — a viewshed effect layered on top of force-based expansion, not a replacement for it: every tile within a tower's current attack range (§10 — grows with tower level, same radius the tower defends) is automatically owned the moment the tower stands there, no militia assault required. The idea is a tower adds elevation, so the player can see (and hold) further. A tile a horde currently occupies is never auto-claimed out from under it — the moment the horde is gone, the ground reclaims itself automatically, though any structure that was on it stays damaged until separately repaired (§12).

*(Note: an earlier draft of this section described the ring unlock alone as the attack gate, with no adjacency requirement — that was a leftover artifact from a prior planned implementation that was discussed but never reconciled here. Adjacency-to-owned is the primary gate; the ring is only a generous outer ceiling on top of it.)*

---

## 7. Extraction Tiles

Every resource type has three tiers — **small → mid → large** — built on suitable terrain, upgraded in place rather than rebuilt. Higher tiers yield disproportionately more (an exponential curve rewards investing in one location over spreading thin), but upgrade costs pull in a widening mix of resource types as you tier up, mirroring a believable "technology" progression (you need wood and stone before you can build the steel and power infrastructure that supports bigger extraction).

None of the five resource types can be built on water — all extraction happens on dry land. Water tiles instead host a distinct building type, the **Dock** (see §16) — a food-generating structure, not a sixth extraction-tile type, and the one exception to "no building on water."

Extraction tiles generate both passive noise (ongoing, scaled to resource rarity) and one-time noise on build/upgrade.

---

## 8. Infrastructure & Automation

**Manual collection is always free and always available** — no path required, the player simply initiates a scout run to a claimed resource tile and it returns with resources. This never goes away; it's the fallback, not a starter-tier mechanic to outgrow.

**Path tiles automate this**, upgraded through three tiers:
- **Goat track** — a worn dirt path, "paid for" in food (sustaining whoever walks it) rather than materials.
- **Stone road** — faster throughput, upgrade cost adds stone.
- **Highway** — near-instant transport (still bottlenecked by the resource tile's own stockpile cap), upgrade cost adds steel.

Paths can be built on any terrain except water, with a throughput penalty for routes crossing mountains. Remote outposts and bidirectional flow (base *supplying* far-flung structures) are explicitly out of scope for this build — resources only ever flow inward, tile → base.

**A tile can hold a path or an extraction tile, never both** (the same one-purpose-per-tile rule as towers/walls, §10) — a path runs *adjacent to* the resource tiles it serves, not on top of them. A resource tile auto-flows if a path chain reaches a tile next to it, or if it sits in a contiguous run of same-resource tiles where at least one neighbor has that adjacency — resources hand off tile-to-tile through the cluster to whichever one touches the road.

---

## 9. Base Progression

The base is a **hub, not a combat unit** — storage, tech tree, and the seat of base-level upgrades, but extraction, defense, and infrastructure all live out on the map, not inside a base minimap.

- **Base level** gates everything: it caps the maximum level any other structure (tower, extraction tile, wall, storage skill) can reach, and determines the **build slot cap** — a hard limit on the total number of structures (of any kind) the player can have standing at once, forcing genuine placement decisions rather than blanket coverage.
- **Base upgrades** cost resources and take real time to complete, continuing even while the player is offline.
- **Base reinforcement** is a separate track — a flat HP pool defending the base tile itself against horde damage, upgradeable independently but capped by base level.
- **Base relocation** (added during playtesting, base level 3+): move the base to any other known (owned or scouted), empty, dry-land tile. Both cost and the countdown scale with straight-line distance to the destination — it's a countdown-then-teleport, not a march through hostile ground, and the countdown exists specifically so relocation can't be used to instantly dodge an incoming horde. The countdown runs even while offline, same as a base-level upgrade. On completion the destination tile joins owned territory if it wasn't already; nothing else about the base (level, reinforcement, upgrade progress) resets.

---

## 10. Combat: Towers & Walls vs. Hordes

Combat against hordes is **fully deterministic** — no luck/RNG rolls (unlike the abandoned PvP design this project pivoted away from).

- **Towers** deal damage at range, every tick a horde remains within reach. Damage output scales with tower level; range extends by one tile per level.
- **Walls** (wood → rock → steel, an upgrade path rather than separate structures) absorb horde damage via durability rather than fighting back. A tile can hold at most one structure of any kind — a tower, a wall, an extraction tile, or a path, never a combination — but a tower's range can cover a wall (or anything else) on a neighboring tile.
- **No tile can host unlimited defense** — the build slot cap forces players to choose which approaches to fortify and which to leave exposed.
- **Walls can only be repaired during peacetime**, at a cost proportional to damage taken (and inclusive of every tier below the wall's current one), and repairing generates its own noise.
- **Demolishing** any structure returns a fixed percentage of everything ever spent on it (build + all upgrades) — deterministic, no luck involved.

---

## 11. Barracks, Watchtowers, Scouting & Units

Watchtowers are built on owned map tiles and level up through twelve tiers, alternating between **range** and **intel depth** upgrades, with an early-warning alert as the final tier. Higher intel levels progressively reveal more about scouted tiles within range: resource quantities, then types, then tile type, then ownership, then everything.

**Barracks** are a separate tile-based structure (levels 1–4, like towers) that train two kinds of units — build slot cap and one-structure-per-tile rules apply the same as any other structure. Multiple barracks stack their capacity contribution.

- **Scout units** — one-time use. Spending one on an unowned tile reveals it permanently, replacing the old per-scout resource cost with a flat per-unit training cost instead (so a tile's scout cost no longer hints at its level the way it briefly did in an earlier pass — that flavor detail is dropped in favor of the simpler unit model). While stockpiled (trained but not yet spent), scouts still cost food upkeep per tick — an idle scout garrison isn't free. A tile can only be scouted if it's adjacent to a **land** tile you already own or have already scouted — knowledge spreads outward from your footprint the same way physical expansion does, not by skipping around freely to arbitrary distant tiles; this is exactly what fog of war (§6) is meant to enforce. The land requirement means a scout can survey the water tile right at a shoreline (that's just looking, not crossing it), but can't chain further out across open water one hop at a time — there's no water-capable unit (yet) to make that crossing.
- **Militia units** — a standing army, cheap to train, that also costs ongoing food upkeep per tick. If upkeep can't be paid, units desert (scouts and militia alike, whichever the current tick's shortfall calls for). Militia count feeds two stats: **attack** (assault power spent two ways — claiming unowned tiles to expand territory, §6, and assaulting zombie dens, §13, resolving what was previously an undefined "assault stats vs. den defense" formula) and **defense** (contributes to the base's last-stand defense alongside base reinforcement HP, §9).

---

## 12. Noise & Horde Mechanics

Noise is the central tension mechanic. Your standing structures set an **ambient noise floor** — a steady-state level your current base settles at, scaling with how many structures you have and their tier (a small food plot is quiet foraging; a large one is a loud, constant factory farm — the same curve applies to paths, from a goat track's footsteps up to a highway's constant traffic). Building or upgrading something spikes noise sharply above that floor, then it rolls back down to the (now slightly higher, since you just added a structure) floor over roughly a couple of minutes.

Noise never fully goes silent once you have any standing structures — it settles at your floor, not at zero. "Going silent" means sitting at that floor rather than actively spiking it further, not eliminating your footprint entirely.

**Zombie dens** (see §13) are the origin points of hordes. Each den's horde-trigger chance and horde size scale with **both** the player's current noise level *and* proximity to that specific den — a loud player near a den is at serious risk; a quiet player far from any den is comparatively safe.

Hordes path toward the noise source using shortest-path logic, preferring open terrain (grassland/forest), avoiding mountains, and unable to cross water. They advance one tile per tick, fighting for each tile in their path — if a horde wins a tile fight, the player loses that tile and must retake it to reclaim territory.

**Territory disconnection:** if a horde's advance fully severs a section of owned territory from the base, that section's stored resources are lost immediately and its buildings become damaged (though not destroyed) — repairable at a reduced cost once the connecting tile is retaken.

---

## 13. Zombie Dens & Win Condition

Dens are fixed map tiles (not roaming threats), seeded once at world-gen at a random level (within a distance-based cap that keeps early game survivable — dens near spawn are capped low, full danger only appears well out from home) and **never change level on their own**. There's no in-fiction mechanism for a den to escalate on a clock — it isn't breeding, and the game's one escalating-threat mechanic is the player's own noise (§12), not a den's timer — so a den's difficulty is exactly what it was assigned at generation, permanently. The variability across the map comes entirely from distance-based world-gen, not from time pressure to clear a den before it "grows."

**Clearing a den is a two-stage siege** (`engine/dens.ts`):
1. **Assault** — dispatch militia/junkyard knights/cross-bow snipers exactly like an expedition (`handleAssaultDen`, mirrors `handleDispatchExpedition`); the party fights its way to the den, then a final one-shot fight against `denDefense` (scales with the den's fixed level) either wins the siege or costs the whole committed party.
2. **Hold period** — on a won assault, the den's coordinate plus a small surrounding ring is claimed into owned territory immediately (so the player can garrison/build right away), and the den enters a timed hold (`tweaks.dens.siege.hold_duration_minutes`). During the hold, escalating last-stand waves (`lastStandWaveSize` — size grows with each wave survived) roll against `holdDefenseAt` — garrison plus any towers in range plus neighboring wall durability, all of it real defense the player actively builds during the hold, not a passive timer. A wave beating that defense reverts the den to hostile (back to its original, unchanged level) and wipes the garrison stationed there; surviving the full hold duration converts it.

A successfully held den **converts into a player-usable Outpost** (`engine/outposts.ts`) — a second, independent economic and defensive hub:
- **Starting strength scales with the den's level**, not a flat baseline: `reinforcementLevel = max(0, denLevel - 1)`, so a tougher den handed a stronger foothold — clearing a high-level den can start a player above their own base's current reinforcement ceiling, a deliberate reward for the conquest (only *further* upgrades are capped by base level, via `maxOutpostReinforcementLevel`).
- **Its own reinforcement HP track**, upgradable/repairable the same shape as the main base's (`outpostReinforcementHp`/`outpostReinforcementUpgradeCost`/`outpostRepairCost`), but paid from the outpost's *own* resource pool, not the main base's.
- **Its own resource economy** — extraction tiles connected to the outpost (same path-connectivity rules as base, `engine/paths.ts`) auto-flow into the outpost's own separate storage, entirely self-contained (§16 covers why this is deliberately one-way for now).
- **A horde overrunning an outpost does not end the game** — unlike the main base, it instead reverts the outpost back to a hostile den (`revertOutpostToDen`, one level below its original — a real setback, but not harder to re-clear than the original siege), which has to be sieged again from scratch. Every live outpost is a defended "hub" exactly like the main base for horde combat purposes (`engine/hordes.ts`'s `HordeHub`), but hordes still only ever *path* toward the main base — an outpost only takes damage if it happens to sit on that route, not because hordes actively hunt it.

**The hidden lab** sits on a single fixed tile somewhere on the map, guarded by a permanently stationed (non-horde) defender tougher than anything else encountered. Its location isn't found through plain scouting — watchtowers and scouting occasionally surface **rumors/clues** narrowing down its general whereabouts.

**Clue mechanism:**
- **Trigger:** every scout action and every active watchtower tick carries a small passive chance to surface a clue, scaling up with that watchtower's intel tier (§11). Clearing a den always awards exactly one clue outright, regardless of the passive roll. Once all clues are collected, no further clues surface.
- **Form:** each clue is a directional hint relative to the base — early clues give a coarse compass quadrant ("something calls from the north"), later clues refine that into a narrower arc ("north-north-east").
- **Precision:** a fixed total of 5 clues, narrowing down to a small cluster of hexes rather than the exact tile — the player still has to manually scout that cluster to pinpoint the lab.

**Win condition:** locate and secure the lab — that alone ends the game in a win. Clearing dens is never required; it's simply one of the best routes to an army strong enough to beat the guardian (and a guaranteed clue source along the way). *(Corrected 2026-07-21 — an earlier pass of this section read "clear every den on the map, then locate and secure the lab," which was never the intent; see ROADMAP.md Milestone 15.)*
**Loss condition:** the base tile's reinforcement HP is depleted by a horde, or the player voluntarily surrenders.

---

## 14. UI / UX

- **Main view:** full-viewport hex map with fog-of-war shading; optional zoom/pan.
- **Persistent stat display:** a small 8-hex cluster, bottom-right — center shows player level, surrounding tiles show attack/defense-equivalent combat stats (towers/walls context), current resource totals, and generation rates; one tile reserved for a future "page" toggle.
- **Base access:** clicking the base tile opens no separate minimap in this design (base is a hub concept, not a nested grid) — base-level actions (upgrades, reinforcement, storage skills) are handled via the same tile-click popup pattern used everywhere else.
- **Tile interaction:** click any tile to see current intel (if scouted) plus available actions and their costs; hover an unscouted tile to preview only its scout cost.
- **Confirmations:** costs are always shown before commitment; most actions execute instantly on click; demolishing requires an explicit confirmation given its permanence.
- **Slide-out panel** (top-right): settings, help/rules reference, and notifications — expected to evolve as development continues.

---

## 15. Explicitly Out of Scope (this build)

- Multiplayer / PvP (the original concept for this project — fully retired in favor of the single-player PvE design above)
- **Bidirectional** outpost↔base resource transport — outposts (§13) shipped as a one-way, self-contained economy; moving resources back to base is deferred to a future "trade caravan" tech-tree upgrade (manual → bike couriers → electric van, each tier with its own per-tick resource cost), which can hook into the outpost's already-separate storage pool without touching this milestone's work
- Water-based transport of resources (moving cargo across water) — a dock's own food output still deposits straight to base, not via a path/highway network the way land tiles do
- Environmental map events
- Difficulty profile variants (structure anticipated, not designed yet)
- Auto-repair skill for walls (mentioned as a future possibility, slower than manual repair)

*(Water-based resources — the "plausible future addition" this list used to defer — shipped during playtesting; see §16, Docks & Water Units. Remote outposts also shipped, with growth-over-time deliberately dropped from the original den concept; see §13.)*

---

## 16. Docks & Water Units

Added during playtesting, outside the milestone sequence in `ROADMAP.md` — the one deliberate exception to §7's "no building on water" rule.

**Docks** are a food-generating building, placed on a water tile that borders land, provided the player owns or has scouted that water tile (the ordinary ownership rule for any other structure would never be satisfiable on open water, since territory expansion is land-adjacency-driven — scouted-or-owned is the water-specific relaxation). A dock yields a flat fraction of a small food extraction tile's rate and deposits straight into base storage every tick — no path connection, since paths can't cross water either. Unlike every land structure, a dock cannot be captured by a horde (hordes can't reach water tiles), so it carries no `damaged` state.

Two dock-only upgrades:
- **Fishing Boat** — a one-time, per-dock build that boosts that dock's yield by half. Purely a yield multiplier plus a cosmetic marker; it doesn't move or do anything else.
- **Scout Skiff** — a mobile unit (capped at one per dock) that wanders randomly across its dock's connected body of water indefinitely, revealing every tile it drifts across — the water equivalent of manual scouting, but automatic and ongoing rather than one tile per unit spent.

A land counterpart exists too: the **Wandering Scout**, trained at a barracks (also capped at one per barracks) by retiring several regular scouts from the stockpile rather than spending resources directly. It wanders connected land the same way the Scout Skiff wanders water, continuously revealing tiles.

Both wandering units use the same movement rule: step to a random adjacent tile of the right terrain class (water for the skiff, non-water for the scout), excluding the tile just left whenever another option exists, so they don't just oscillate between two tiles — and they're otherwise unconfined, free to roam anywhere connected reachable ground/water, not tied to a fixed patrol radius around their home structure.

---

## 17. Architecture Summary

- **Offline-first PWA** — no server dependency for core gameplay. State persists locally (IndexedDB), with a Service Worker enabling full offline play.
- **Save files, not accounts** — IndexedDB holds the active session for crash/continue convenience, but the real save/load mechanism is an old-school, explicit save-to-file / load-from-file flow. Files are plain JSON, human-editable, and untrusted by design — single-player game, so if someone wants to hand-edit their save, that's entirely their call.
- **Procedural seed** determines the entire map at generation time — same seed reproduces the same world.
- **Tweaks-file driven balance** — nearly every numeric value in this design (costs, yields, timers, noise, horde scaling) is externalized to `tweaks.jsonc`, read at load time, so the whole economy can be retuned without touching game logic.
