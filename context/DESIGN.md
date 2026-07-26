# Hex World — DESIGN.md

**Genre:** Single-player, offline-first hex strategy / base-defense
**Session shape:** One-off skirmish campaign, AoE-style — load up, play 30–90 minutes, reach an outcome (win or loss), done.
**Platform:** Offline-capable PWA (and/or standalone APK later). No server dependency, no login, no account.

Exact tunable numbers (costs, yields, formulas) live in `tweaks.jsonc` / `TWEAKS.md` — this document describes the *systems*, not the specific values.

---

## 1. Premise

A small group arrives in unfamiliar territory. They settle, and immediately claim the ground around them. Beneath the surface tension of resource management and expansion is a slow-burning threat: zombie dens scattered across the map, each a fixed, knowable danger — tougher ones further from home — spawning hordes that hunt by sound. Somewhere out there is a hidden lab holding a cure. Locate and secure the lab, and you win — clearing dens helps, but is never required. Let a horde through your defenses at the wrong moment, and your base — and the run — is over.

---

## 2. Core Loop

**Settle → Extract → Automate → Fortify → Expand → Confront**

1. **Settle:** Choose where to place your first extraction tiles and any early defenses within your starting territory.
2. **Extract:** Resource tiles generate food, wood, stone, and steel passively, in real time. Power is supplied by **power stations** (capacity over an area of effect), not stockpiled from extraction.
3. **Automate:** Upgrade extraction (and docks) to unlock implied **couriers** that haul local stockpiles to base; steel uses **Scrappers** via scrap stashes and a Scrap Yard (Milestone 26).
4. **Fortify:** Place towers and walls — strategically, since build slots are capped and you can never fully wall off.
5. **Expand:** Scout and attack tiles beyond your starting territory with militia, following clues toward zombie dens and the hidden lab.
6. **Confront:** Follow clues to the hidden lab and secure it to win; assault dens along the way for outposts, army strength, and guaranteed clues — or lose your base to a horde.

---

## 3. The World

- **Grid:** procedurally seeded hex map — **32×32**, **64×64**, **96×96**, or **128×128** (chosen under onboarding advanced options; default **32**). A seed value fully determines terrain, resources, **starting base location**, den placement, and lab location for that size — enables sharing/replaying seeds at the same map size. Larger maps place more dens with wider spacing.
- **Coordinate system:** tiles are stored/serialized as **axial coordinates (q, r)** — simple two-integer keys, natural for save files. Algorithms that need them (distance, range queries, horde pathing line-of-travel) convert to cube coordinates internally.
- **Terrain types:** grassland, forest, mountain, shore, water — each restricts which structures can be built on it.
- **Transition tiles:** procedurally occur where two terrain types border each other. Either terrain's structures can be built there, at half yield. The game never explains this — scouting one only returns a cryptic hint.
- **Natural resource tiles:** carry a level (1–24) determining yield when interacted with, and regenerate over time if depleted.

---

## 4. Player Onboarding

No login, no email, no account. On arrival, the player finds a short **field manual** — aged paper, in-world prose, not a terminal UI — and pages through it before play begins:

1. **Cover** — title and hook.
2. **Registration** — name, inline colour wheel, and (under **Show Advanced Options**, collapsed by default) **map size** (32×32 / 64×64 / 96×96 / 128×128 unless the profile sets `grid_size_locked`; default 32), difficulty profile, optional world seed (unless the profile sets `world_seed`), and recent seeds for replay. Profile tweaks take precedence for locked scenario fields.
3. **Story pages** (four brief log entries) — settling the starting territory, how noise draws hordes, the rumoured hidden lab (securing it wins the run; clearing dens is valuable but not required), and a light in-fiction nudge before heading out.
4. **Send-off** — closing line, then into the game.

An existing local save shows a **continue-or-new-game** prompt (styled as a notebook page) before onboarding — **Continue** resumes, **New Game** clears the save and opens the manual, **Load** imports a JSON save file. Choosing **Start as a new player** from the new-game dialog shows the full manual again.

**Difficulty profiles:** selectable in advanced registration options and via URL `/{slug}` on the game domain (`play.{domain}`). Each profile loads `public/profiles/{slug}/tweaks.jsonc`; optional partial sprites under `profiles/{slug}/assets/` fall back to `profiles/default/assets/`. See `context/TWEAKS.md` § Profiles. Default terrain art was replaced under legacy #P12 ([issue #66](https://github.com/zachflem/hexWorld/issues/66)); per-level structure sprites resolve via Milestone 24 / legacy #P13 ([issue #67](https://github.com/zachflem/hexWorld/issues/67)) (levelled filename → unlevelled default).

Progress persists locally in IndexedDB automatically during play, so closing the tab mid-session doesn't lose anything. For anything beyond that — moving a game to another device, keeping a backup, running separate playthroughs side by side — the player explicitly **saves to a file** (see §17).

---

## 5. Resources

Four stockpile types, ascending in rarity: **food → wood → stone → steel**. Rarity determines both extraction yield (common resources yield more) and noise generated while gathering (rarer resources are louder).

Each resource has its own **storage cap**, upgraded independently via a tech-tree skill (no physical building required) — capacity doubles per level.

### Power network

**Power** is not a fifth stockpile resource. **Power stations** (levels 1–4) supply **capacity** over an **area of effect**; both grow with station level. Active stations’ coverage forms a **union**; capacity and draw are a **shared pool** (`powerFactor = capacity / draw`).

- Level/tier **1** structures never need power and do not draw.
- Level/tier **≥ 2** structures on powered tiles draw load (scaled by level). Outside coverage — or when `powerFactor` falls below the cut-off — they go **offline** (no yield/DPS/courier progress/Scrapper progress/training progress/wall dampening). Between cut-off and full supply they **brown out** (performance scaled by `powerFactor`).
- Hub work (storage upgrades, research, base level-up) does not require a powered base tile. See [Milestone25.md](Milestone25.md) / [issue #70](https://github.com/zachflem/hexWorld/issues/70).

---

## 6. Starting Territory

The **base location** is chosen deterministically from the world seed anywhere the starting owned spiral fits in-bounds — including toward corners and edges, not only near map center — scored to prefer a mixed starting footprint (forest / mountain / shore in the owned rings, not only open grassland). Harder local starts are allowed; the base is never on water. Dens and lab placement remain relative to whatever base the seed selected.

The player owns their base tile plus the first two full rings around it (19 tiles total) **immediately, with no claiming action required** — this is their camp, not conquered ground. Starting resources are set so the player can build exactly one food, one wood, and one stone extraction tile right away, with a modest buffer left over.

**Fog of war** begins exactly one ring past owned territory: the first unclaimed ring is heavily shaded (representing "known but unclear"), the next ring past that is barely visible, and everything beyond is fully hidden until scouted. Watchtowers (see §11) clear fog fully within their range; the same stepped shading resumes just beyond that range. Owned and scouted tiles are both fog-clearing centers, and both behave identically as one: each radiates the same heavy → light roll-off outward from itself, and neither one grants a fully-clear plateau bleeding onto neighbors that aren't themselves owned or scouted — only the literal owned/scouted tile itself is fully clear. This matters because a tile merely adjacent to (and attackable from) owned territory is not automatically visible: expanding your zone of full clarity still requires actually taking or scouting each tile (see below), not just standing next to it — "attack blind" has to actually mean blind. A scouted tile remains visually distinct from an owned one either way (it's knowledge, not territory), even though their halos match.

**Expanding beyond the starting 19** is mostly not automatic — the primary route is force along your footprint. In the current build this is an **expedition**: the player commits a mixed party (militia/knights/snipers) and provisions to a route through **owned ∪ scouted** ground (pathfinding prefers owned corridors). The party claims unowned scouted tiles as it crosses them (free-claim — no tile-defense wipe). With **Improved Optics** researched, each stepped tile also free-claims its first ring of unowned neighbors (including water; skips horde-occupied tiles), so shoreline water can become owned without pathing onto it. A **horde** on the road is fight-or-wipe (`partyAttackPower >= hordeSize` clears it with no losses; otherwise the party is destroyed and tombstoned). Mid-march **recall** marches home with **no food refund** (outbound provisions stay sunk; return leg is free). Mid-march **redeploy** retargets from the party’s current hex — full re-quote for the new leg, again with no refund of the old route. On arrival the party waits for a short decision window with parallel options: **redeploy**, **reinforce** (inbound detachment from home), **garrison** (station here, cancel wait), **recall** (march home now), or **no selection** (auto-recall when the timer expires). Choices are offered on the arrival HUD notification and on the destination tile’s bottom sheet (**Party orders**). Den/lab assaults keep the legacy corridor tile-defense fight; they cannot redeploy mid-march but **can cancel/recall** home to their dispatch origin (free return). Scouted fog still matters because routes cannot cut through dark tiles.

**Towers also claim passively** — a viewshed effect layered on top of force-based expansion, not a replacement for it: every tile within a tower's current attack range (§10 — grows with tower level, same radius the tower defends) is automatically owned the moment the tower stands there, no militia assault required. The idea is a tower adds elevation, so the player can see (and hold) further. A tile a horde currently occupies is never auto-claimed out from under it — the moment the horde is gone, the ground reclaims itself automatically, though any structure that was on it stays damaged until separately repaired (§12).

*(Note: an earlier draft of this section described the ring unlock alone as the attack gate, with no adjacency requirement — that was a leftover artifact from a prior planned implementation that was discussed but never reconciled here. Adjacency-to-owned is the primary gate; the ring is only a generous outer ceiling on top of it.)*

---

## 7. Extraction Tiles

**Food, wood, and stone** each use land extraction tiles with three shipped levels — **L1 → L2 → L3** (internally still small/mid/large in places). Higher levels yield more (an exponential curve rewards investing in one location over spreading thin), and upgrade costs pull in a widening mix of resource types as you tier up. Player-facing meaning:

| Level | Effect |
|-------|--------|
| L1 | Manual collect (pin at ~60% local fill) |
| L2 | Implied courier auto-hauls to the main base |
| L3 | Production increase (further L4/L5 are designed, not required yet) |

**Steel is not an extraction tile.** It enters the economy only through world-gen **scrap stashes** and a **Scrap Yard** / **Scrapper** loop (see §8).

None of the land extraction types can be built on water — those sit on dry land. Water tiles instead host a distinct building type, the **Dock** (see §16) — a food-generating structure, not a fifth extraction-tile type, and the one exception to "no building on water."

Extraction tiles generate both passive noise (ongoing, scaled by resource rarity) and one-time noise on build/upgrade.

---

## 8. Infrastructure & Automation

**Manual collection is always free and always available** — open a claimed resource structure's tile sheet to pull its local stockpile into the shared pool instantly. This never goes away; it's the L1 fallback, not a starter-tier mechanic to outgrow. Map **collect pins** stay hidden until the local stockpile reaches a fill threshold (`storage.collect_pin_show_ratio`, default 60% on L1). Courier-automated sites (L2+) only show a pin when the local buffer is full (`storage.collect_pin_courier_show_ratio`, default 100%) — usually because hub storage can't take more — and toast when both hub storage and that local stockpile are full. Affordable **upgrade** hints use the orange level badge, not the collect pin.

**Couriers automate collection** once a food / wood / stone extraction tile, **dock**, or **Scrap Yard** reaches **level 2+**. The courier is an *implied* unit (no train/assign UI, no dedicated map sprite): it loops structure → **main base** → structure. Round-trip travel time reuses expedition route math — Dijkstra path cost over owned∪scouted ground × `expeditions.travel_seconds_per_cost` — so farther or mountain-heavier sites take longer. That distance cost **is** the automation penalty. Level 3 (and later L4/L5) raise production / collection speed rather than inventing a parallel road network. L2+ structures also draw power when covered (and go offline / brown out with the rest of the grid).

**There are no infrastructure path tiles** (goat track / stone road / highway are removed). A hex still holds at most one structure — extraction, tower, wall, barracks, dock, power station, or **Scrap Yard** — never a combination.

**Steel** does not use land extraction tiles. World-gen **scrap stashes** (finite steel pools, grey ring when known, banded richness hints) are hauled by a visible **Scrapper** into a **Scrap Yard** local stockpile. L1 yards are manual-collect only; L2+ yards run an implied last-mile courier into the shared pool. Yard level also gates Scrapper capacity/speed (Auto next-stash at L3). Details: [Milestone26.md](Milestone26.md), [ScrapperEconomy.md](ScrapperEconomy.md).

Remote outposts as alternate courier destinations and bidirectional flow (base *supplying* far-flung structures) stay out of scope for MVP — resources only ever flow inward, structure → base.

---

## 9. Base Progression

The base is a **hub, not a combat unit** — storage, tech tree, and the seat of base-level upgrades, but extraction, defense, and infrastructure all live out on the map, not inside a base minimap.

- **Base level** gates everything: it caps the maximum level any other structure (tower, extraction tile, wall, storage skill) can reach, and determines the **build slot cap** — a hard limit on the total number of structures (of any kind) the player can have standing at once, forcing genuine placement decisions rather than blanket coverage.
- **Base upgrades** cost resources and take real time to complete, continuing even while the player is offline.
- **Base reinforcement** is a separate track — a flat HP pool defending the base tile itself against horde damage, upgradeable and repairable on real-time timers (offline-safe), capped by base level. **Only one** base level upgrade, reinforcement upgrade, or reinforcement repair can run at a time — the same single-slot rule walls use for tier upgrades vs. durability repair.
- **Base relocation** (added during playtesting, base level 3+): move the base to any other known (owned or scouted), empty, dry-land tile. Both cost and the countdown scale with straight-line distance to the destination — it's a countdown-then-teleport, not a march through hostile ground, and the countdown exists specifically so relocation can't be used to instantly dodge an incoming horde. The countdown runs even while offline, same as a base-level upgrade. On completion the destination tile joins owned territory if it wasn't already; nothing else about the base (level, reinforcement, in-progress upgrade/repair) resets. Relocation uses its own timer and does not block (or get blocked by) the single action slot above.

---

## 10. Combat: Towers & Walls vs. Hordes

Combat against hordes is **fully deterministic** — no luck/RNG rolls (unlike the abandoned PvP design this project pivoted away from).

- **Towers** deal damage at range, every tick a horde remains within reach. Damage output scales with tower level; range extends by one tile per level, plus a flat offset from the tower's build-tile terrain (mountain longer, forest shorter, grassland/shore unchanged — see `towers.range_terrain_offset`).
- **Walls** (wood → rock → steel, an upgrade path rather than separate structures) absorb horde damage via durability rather than fighting back. A tile can hold at most one structure of any kind — a tower, a wall, an extraction tile, a barracks, a dock, a **power station**, or a **Scrap Yard** — never a combination — but a tower's range can cover a wall (or anything else) on a neighboring tile.
- **No tile can host unlimited defense** — the build slot cap forces players to choose which approaches to fortify and which to leave exposed.
- **Walls can only be repaired during peacetime**, at a cost proportional to damage taken (and inclusive of every tier below the wall's current one), and repairing generates its own noise.
- **Demolishing** any structure returns a fixed percentage of everything ever spent on it (build + all upgrades) — deterministic, no luck involved.

---

## 11. Barracks, Watchtowers, Scouting & Units

Watchtowers are built on owned map tiles and level up through twelve tiers, alternating between **range** and **intel depth** upgrades, with an early-warning alert as the final tier. Higher intel levels progressively reveal more about scouted tiles within range: resource quantities, then types, then tile type, then ownership, then everything.

**Barracks** are a separate tile-based structure (levels 1–4, like towers) that train standing combat units and build land explorers — build slot cap and one-structure-per-tile rules apply the same as any other structure. Multiple barracks stack their capacity contribution.

- **Wandering Scout** — the land exploration unit (max one per barracks). Built for a flat resource cost equal to ten old one-shot scout train costs (300 food + 200 wood), with a build timer; no stockpile / retire gate. Once complete it wanders connected land forever, revealing every tile it visits (`engine/wanderingScouts.ts`). With **Improved Optics** researched, each step also reveals the first land ring around the stepped hex (water excluded). There is no trainable one-shot scout and no manual adjacent-tile reveal — land fog clears only through Wandering Scouts (water through Scout Skiffs, § water units below).
- **Militia units** — a standing army, cheap to train, that also costs ongoing food upkeep per tick. If upkeep can't be paid, units desert (cheapest standing unit first). Militia count feeds two stats: **attack** (assault power spent two ways — claiming unowned tiles to expand territory, §6, and assaulting zombie dens, §13) and **defense** (contributes to the base's last-stand defense alongside base reinforcement HP, §9).

---

## 12. Noise & Horde Mechanics

Noise is the central tension mechanic. Your standing structures set an **ambient noise floor** — a steady-state level your current base settles at, scaling with how many structures you have and their tier (a small food plot is quiet foraging; a large one is a loud, constant factory farm). Building or upgrading something spikes noise sharply above that floor, then it rolls back down to the (now slightly higher, since you just added a structure) floor over roughly a couple of minutes.

Noise never fully goes silent once you have any standing structures — it settles at your floor, not at zero. "Going silent" means sitting at that floor rather than actively spiking it further, not eliminating your footprint entirely.

**Zombie dens** (see §13) are the origin points of hordes. Each den's horde-trigger chance and horde size scale with **both** the player's current noise level *and* proximity to that specific den — a loud player near a den is at serious risk; a quiet player far from any den is comparatively safe.

Hordes path toward the noise source using shortest-path logic, preferring open terrain (grassland/forest), avoiding mountains, and unable to cross water. They advance one tile per tick, fighting for each tile in their path — if a horde wins a tile fight, the player loses that tile and must retake it to reclaim territory. Capture strips ownership and damages structures, but **does not wipe fog knowledge**: the tile stays scouted so it remains visible and reclaimable without rediscovery (Wandering Scout / Scout Skiff are the only reveal paths).

**Territory disconnection:** if a horde's advance fully severs a section of owned territory from the base, that section's stored resources are lost immediately and its buildings become damaged (though not destroyed) — repairable at a reduced cost once the connecting tile is retaken.

---

## 13. Zombie Dens & Win Condition

Dens are fixed map tiles (not roaming threats), seeded once at world-gen at a random level (within a distance-based cap that keeps early game survivable — dens near spawn are capped low, full danger only appears well out from home) and **never change level on their own**. There's no in-fiction mechanism for a den to escalate on a clock — it isn't breeding, and the game's one escalating-threat mechanic is the player's own noise (§12), not a den's timer — so a den's difficulty is exactly what it was assigned at generation, permanently. The variability across the map comes entirely from distance-based world-gen, not from time pressure to clear a den before it "grows."

**Clearing a den is a two-stage siege** (`engine/dens.ts`):
1. **Assault** — dispatch militia/junkyard knights/cross-bow snipers exactly like an expedition (`handleAssaultDen`, mirrors `handleDispatchExpedition`); the party fights its way to the den, then a final one-shot fight against `denDefense` (scales with the den's fixed level) either wins the siege or costs the whole committed party.
2. **Hold period** — on a won assault, the den's coordinate plus a small surrounding ring is claimed into owned territory immediately (so the player can garrison/build right away), and the den enters a timed hold (`tweaks.dens.siege.hold_duration_minutes`). During the hold, escalating last-stand waves (`lastStandWaveSize` — size grows with each wave survived) roll against `holdDefenseAt` — garrison plus any towers in range plus neighboring wall durability, all of it real defense the player actively builds during the hold, not a passive timer. A wave beating that defense reverts the den to hostile (back to its original, unchanged level) and wipes the garrison stationed there; surviving the full hold duration converts it.

A successfully held den **converts into a player-usable Outpost** (`engine/outposts.ts`) — a second, independent economic and defensive hub:
- **Starting strength scales with the den's level**, not a flat baseline: `reinforcementLevel = max(0, denLevel - 1)`, so a tougher den handed a stronger foothold — clearing a high-level den can start a player above their own base's current reinforcement ceiling, a deliberate reward for the conquest (only *further* upgrades are capped by base level, via `maxOutpostReinforcementLevel`).
- **Reinforcement HP track**, upgradable/repairable the same shape as the main base's (`outpostReinforcementHp` / upgrade / repair), paid from the **shared stockpile** (same pool as the main base).
- **Shared resource economy** — couriers deliver into the **same global stockpile** whether the structure sits near the main base or an outpost foothold; MVP courier destination is the main base ([ScrapperEconomy.md](ScrapperEconomy.md) Q67). An outpost is an alternate defensive/economic hub, not a second resource pool.
- **A horde overrunning an outpost does not end the game** — unlike the main base, it instead reverts the outpost back to a hostile den (`revertOutpostToDen`, one level below its original — a real setback, but not harder to re-clear than the original siege), which has to be sieged again from scratch. Every live outpost is a defended "hub" exactly like the main base for horde combat purposes (`engine/hordes.ts`'s `HordeHub`), but hordes still only ever *path* toward the main base — an outpost only takes damage if it happens to sit on that route, not because hordes actively hunt it.

**The hidden lab** sits on a single fixed tile somewhere on the map, guarded by a permanently stationed (non-horde) defender tougher than anything else encountered. Watchtowers guide the search; den clears refine it; Wandering Scouts (or Scout Skiffs) can still stumble onto the lab hex without any clues.

**Clue / search mechanism:**
- **Den clues:** clearing a den always awards exactly one directional **clue**. A fixed total of 5 clues (`lab_clues.total_clues`) — Wandering Scouts never increment this. Early clues are a coarse compass quadrant relative to the base; later clues refine into a narrower arc. Once all 5 are in, the map highlights a jittered **search cluster** (scouted tiles: light player-color tint; unscouted tiles: slightly reduced fog) via `labSearchZoneCenter` — not the exact lab tile.
- **Watchtower signals:** active watchtowers (level 2+) occasionally pick up a vague directional **signal** (coarse compass quadrant toward the lab). Signals are not clues; they bias wandering-scout steps toward that sector and pull toward the true lab tile so guided search is more likely to reveal it. Finding the lab clears the active signal; once all den clues are collected, no further signals surface.
- **Scout reveal:** Wandering Scouts / Scout Skiffs reveal fog as usual — including the lab hex if they step it — with or without clues or a search cluster.
- **Alerts:** when a horde first enters an active watchtower's combat range, the tower raises an early-warning toast (separate from combat DPS).

**Win condition:** locate and secure the lab — that alone ends the game in a win. Clearing dens is never required to win (a lucky scout can find the lab early), but dens are the only source of the five clues that unlock the search-cluster hint, plus outposts and army growth toward the guardian. See [Milestone 15](https://github.com/zachflem/hexWorld/milestone/16) / [`context/Milestone15.md`](Milestone15.md).
**Loss condition:** the base tile's reinforcement HP is depleted by a horde, or the player voluntarily surrenders.

---

## 14. UI / UX

- **Main view:** full-viewport hex map with fog-of-war shading; optional zoom/pan.
- **Persistent stat display:** a small 8-hex cluster, bottom-right — center shows player level, surrounding tiles show attack/defense-equivalent combat stats (towers/walls context), current resource totals, and generation rates; one tile reserved for a future "page" toggle.
- **Base access:** clicking the base tile opens no separate minimap in this design (base is a hub concept, not a nested grid) — base-level actions (upgrades, reinforcement, storage skills) are handled via the same tile-click popup pattern used everywhere else.
- **Tile interaction:** click any tile to see current intel (if scouted) plus available actions and their costs.
- **Confirmations:** costs are always shown before commitment; most actions execute instantly on click; demolishing requires an explicit confirmation given its permanence.
- **Top-right HUD:** a fixed column stacks **timer notifications** (builds, upgrades, repairs, training, expeditions, assaults, recalls, sieges) and **one-off toasts** (e.g. den cleared, lab clue). Each row shows its icon on the left, label/coords, and remaining time. After **5 seconds** realtime the label/countdown slides away to the right, leaving a compact **icon peek** at the column edge; tap the icon to expand again. Active countdown rows stay peeking until the timer finishes; ephemeral toasts linger collapsed briefly then dismiss. **Exception — expedition arrival orders:** the decision row stays expanded until the player dismisses it or the auto-recall deadline fires; dismiss collapses to the usual highlighted icon peek (row remains until recall). A separate **slide-out panel** (same corner) holds settings, help/rules reference, and is expected to evolve.

---

## 15. Explicitly Out of Scope (this build)

- Multiplayer / PvP (the original concept for this project — fully retired in favor of the single-player PvE design above)
- **Trade caravan** — retired (#P4). Outposts feed the shared stockpile; no outpost↔base transfer layer needed.
- Water-based transport of resources (moving cargo across water) — docks use the same L1 manual / L2+ courier model as land extraction (not a water barge system)
- Environmental map events
- Auto-repair skill for walls (mentioned as a future possibility, slower than manual repair)
*(Water-based resources — the "plausible future addition" this list used to defer — shipped during playtesting; see §16, Docks & Water Units. Remote outposts also shipped, with growth-over-time deliberately dropped from the original den concept; see §13. Default terrain pack swap shipped as legacy #P12 ([issue #66](https://github.com/zachflem/hexWorld/issues/66)); see [attribution.md](attribution.md). Per-level structure sprite lookup shipped as Milestone 24 / [#67](https://github.com/zachflem/hexWorld/issues/67).)*

---

## 16. Docks & Water Units

Added during playtesting, outside the milestone sequence in `ROADMAP.md` — the one deliberate exception to §7's "no building on water" rule.

**Docks** are a food-generating building, placed on a water tile that borders land, provided the player owns or has scouted that water tile (the ordinary ownership rule for any other structure would never be satisfiable on open water, since territory expansion is land-adjacency-driven — scouted-or-owned is the water-specific relaxation). A dock yields a flat fraction of a small food extraction tile's rate into a **local stockpile**. At **L1** you collect manually; at **L2+** an implied courier hauls to the main base (same travel timing as land extraction). **L3** is the production upgrade (includes the old fishing-boat yield bonus). Unlike every land structure, a dock cannot be captured by a horde (hordes can't reach water tiles), so it carries no `damaged` state.

Dock-only unit:
- **Scout Skiff** — a mobile unit (capped at one per dock) that wanders randomly across its dock's connected body of water indefinitely, revealing every tile it drifts across — the water equivalent of the Wandering Scout, automatic and ongoing.

A land counterpart exists too: the **Wandering Scout**, built at a barracks (also capped at one per barracks) for a flat mid-game resource cost. It wanders connected land the same way the Scout Skiff wanders water, continuously revealing tiles.

Both wandering units use the same movement rule: step to a random adjacent tile of the right terrain class (water for the skiff, non-water for the scout), excluding the tile just left whenever another option exists, so they don't just oscillate between two tiles — and they're otherwise unconfined, free to roam anywhere connected reachable ground/water, not tied to a fixed patrol radius around their home structure.

---

## 17. Architecture Summary

- **Offline-first PWA** — no server dependency for core gameplay. State persists locally (IndexedDB), with a Service Worker enabling full offline play.
- **Save files, not accounts** — IndexedDB holds the active session for crash/continue convenience, but the real save/load mechanism is an old-school, explicit save-to-file / load-from-file flow (Settings; also load from the continue prompt and onboarding cover). Files are plain JSON (`format: "hexworld-save"`, versioned envelope in `src/data/gamePersistence.ts`), human-editable, and untrusted by design — single-player game, so if someone wants to hand-edit their save, that's entirely their call.
- **Procedural seed** determines the entire map at generation time — same seed reproduces the same world.
- **Tweaks-file driven balance** — nearly every numeric value lives in per-profile `tweaks.jsonc` files under `public/profiles/{slug}/`, loaded from the URL slug or onboarding selection, validated at boot with Zod (`src/data/tweaksSchema.ts`).
- **Difficulty profiles** — `public/profiles/index.json` registers shipped profiles (`default`, `hard`, …). Each folder contains `tweaks.jsonc` plus optional `assets/` (partial sprite overrides). Default art lives in `public/profiles/default/assets/` (`terrain/`, `structures/`, `resources/`, `units/`, `markers/`). Asset resolution: active profile → default profile → flat-colour fallback (`src/render/assetPaths.ts`). Structure icons also try level/tier variants before the unlevelled name ([issue #67](https://github.com/zachflem/hexWorld/issues/67) / [Milestone24.md](Milestone24.md)). `profileSlug` is persisted in IndexedDB with the save. Default terrain tiles were replaced under legacy #P12 (flat-hex sources → 256×384 via `scripts/convert-flat-terrain-hex.py`). **Milestone 26 shipped on `goblin`:** couriers replace path auto-flow; steel via Scrap Yard / Scrapper / stashes; expedition mid-route parity (Q40–Q46). See [Milestone26.md](Milestone26.md) / [issue #36](https://github.com/zachflem/hexWorld/issues/36); design Q&A in [ScrapperEconomy.md](ScrapperEconomy.md).
- **Domain split (planned deploy)** — marketing/wiki at `hexworld.seezed.net`; game PWA at `play.{domain}` with `/{slug}` deep links. Git workflow: personal branches `goblin` / `krunchee` → `dev` → `main` (`context/WORKFLOW.md`).

