# Hex World — Player Guide

A small group arrives in unfamiliar territory and settles in. You'll build up an economy, automate resource collection, and fortify your position — because the noise you make draws zombie hordes, and if one ever reaches your base and breaks through, the run ends.

This guide describes the game **as it currently plays**, not as originally envisioned — see the note on the win condition near the bottom.

---

## Getting started

When you first open the game, you'll be asked for a **name** and a **colour** (used to tint your base and territory outline on the map). You can optionally enter a **seed** — a number that fully determines the map layout, terrain, and everything on it. Leave it blank for a random map, or enter a specific number to replay a map you (or someone else) has seen before; the same seed always generates the exact same world.

Progress saves automatically in your browser (IndexedDB) as you play — closing the tab is safe.

### Starting a new game later

From the in-game menu (☰, top of screen) or from the game-over screen, choose **New Game** to get three options:
- **Replay the current map** — same seed, fresh start, same layout.
- **Start a new game** — a freshly-generated random seed (or type your own).
- **Start as a new player** — re-enter your name/colour from scratch.

All three wipe current progress, so use them deliberately.

---

## The world

- The map is a **128×128 grid of hexes**, procedurally generated from your seed.
- **Terrain types:** grassland, forest, mountain, shore, and water. Each restricts what you can build there.
- **Transition tiles** occur where two terrain types border each other — either terrain's structures can be built there, but at **half yield**. The game won't tell you this outright; scouting one only gives a cryptic hint that "something's different" about it.
- **Fog of war:** you start with full visibility of your own territory. Beyond that, visibility fades in rings — heavily shaded just past your border, barely visible past that, and fully hidden further out. Scouted tiles reveal themselves the same way owned tiles do, but stay visually distinct (it's knowledge, not ownership).

---

## Your starting position

You begin owning your base tile plus the two full rings around it (19 tiles) outright — no claiming needed. You start with enough food, wood, and stone to build one extraction tile of each of those three types, with a modest buffer left over.

---

## Resources

Five types, in ascending rarity: **food → wood → stone → steel → power**. Rarer resources yield less per tile and generate more noise while being gathered.

Each resource has its own **storage cap** at your base (1000 at level 1, doubling per storage upgrade level — upgraded via a tech-tree skill, no building required).

---

## Extraction tiles

Build one on suitable land (never on water) to generate a resource passively. Each has three tiers — **small → mid → large** — upgraded in place, not rebuilt; each tier yields substantially more than the last, but costs a wider mix of resources to reach (e.g. a large steel tile needs stone and wood investment too, not just steel).

Building extraction tiles gets progressively more expensive the more of that type you already have (your 2nd food tile costs more than your 1st, and so on).

**Collecting resources:**
- **Manual collection** is always free and always available — click the tile and collect its local stockpile by hand.
- **Infrastructure paths** automate this. Build a path adjacent to a resource tile (or a connected cluster of the same resource) to have it auto-flow to base storage every tick, no clicking required. Paths come in three tiers:
  - **Goat track** — cheap, slow, paid for in food rather than materials.
  - **Stone road** — faster throughput.
  - **Highway** — near-instant transport.
  
  Paths can cross any terrain except water, with a throughput penalty over mountains.

A tile can only hold one thing at a time — an extraction tile, a path, a tower, a wall, a barracks, or a dock — never a combination.

---

## Your base

The base is a hub, not a fighting unit — it holds your storage, tech upgrades, and base-level progression, but doesn't defend itself except through its **reinforcement HP**.

- **Base level** caps how far every other structure type can be upgraded, sets your **build slot cap** (the total number of structures you're allowed to have standing at once — 10 at level 1, +10 per level), and widens how far from your territory you're allowed to attack/claim tiles.
- **Base upgrades** cost resources and take real time — they keep counting down even while you're offline.
- **Reinforcement HP** is a separate, upgradeable pool defending the base tile itself. If a horde deals more damage than your current reinforcement HP (plus any garrison stationed there) can absorb, **the base falls and the run ends.** A successful defense still costs HP, so repeated assaults need repair even if none of them individually break through.
- You can also **relocate your base** to a different owned tile once you meet the base-level requirement (costs resources and time).

---

## Defenses: Towers & Walls

- **Towers** deal ranged damage to any horde within reach, every tick, for as long as it stays in range. Both damage and range grow with tower level (levels 1–4). Militia stationed on a tower's own tile add their attack power straight onto its damage. A horde lingering in a tower's range is also visibly slowed.
- **Walls** (wood → rock → steel, an upgrade path) don't fight back — they soak up horde damage via durability instead. They can only be repaired during peacetime, at a cost proportional to the damage they've taken.
- **Demolishing** any structure refunds a fixed percentage of everything you ever spent on it (build + every upgrade).
- A structure a horde captures goes **damaged** (non-functional) until you retake the tile and pay to repair it.

There's no way to wall off everything — your build slot cap forces real choices about what to fortify and what to leave exposed.

---

## Barracks & units

Barracks (levels 1–4, same one-structure-per-tile rule as everything else) train:

- **Scouts** — one-time use. Spend one on an unowned tile adjacent to your existing land/scouted footprint to reveal it permanently (this also shows its defense value before you attack it). Trained scouts sitting in reserve still cost food upkeep.
- **Militia** — a standing army. Feeds both your **attack power** (used to claim unowned tiles and to fight hordes automatically from a garrison) and your **defense** (adds to the base's last-stand HP pool). Costs ongoing food upkeep; units desert if you can't pay it.
- **Junkyard Knights** (barracks level 2+) and **Cross-Bow Snipers** (barracks level 3+) — tougher/pricier units with their own attack/defense stats. Snipers additionally deal ranged damage to any horde within range of wherever they're garrisoned.
- **Wandering Scout** — a persistent unit built by retiring 10 regular scouts from your stockpile (max 1 per barracks). Instead of a single reveal, it wanders your connected land automatically, forever, quietly revealing tiles as it roams. Shown on the map as a walking icon.

You can **garrison** militia/knights/snipers on any owned tile — a garrison automatically attacks any horde on its own tile or a neighboring one, and stacks additively with whatever structure is on that tile.

**Expeditions:** dispatch a party of militia/knights/snipers along a route to claim tiles beyond your current border (further than a simple adjacent attack) — you commit provisions and a chosen mix of units, and the party either succeeds (claiming everything along the way) or is lost if the route gets cut off by a horde in transit.

Towers also **passively claim territory** just by existing — every tile within a tower's range becomes owned automatically, no assault needed, as if the tower gave you a better vantage point.

---

## Docks & the water

Water tiles can't host normal extraction tiles, paths, or defenses — but you can build a **Dock** on any water tile bordering land (as long as you own or have scouted that water tile). A dock generates food automatically (about 70% the rate of a standard food extraction tile) and deposits straight to base storage every tick — no path connection needed.

Two upgrades, per dock:
- **Fishing Boat** — a one-time build that boosts that dock's food output by 50%. Shows a little boat icon once built.
- **Scout Skiff** — a mobile unit (max 1 per dock) that wanders its connected body of water forever, revealing every tile it drifts past — the water equivalent of the Wandering Scout.

Docks can't be captured by hordes (hordes can't cross water), so they're a low-risk, if modest, income source.

---

## Noise & hordes — the core tension

Every structure you have contributes to an **ambient noise floor** — a steady-state level your base settles at. Building, upgrading, or repairing something spikes noise sharply above that floor, then it decays back down over a couple of minutes. More/higher-tier structures mean a higher floor; you're never fully silent once you've built anything.

**Below 30dB — your quietest possible floor — hordes have nothing to hear and simply won't spawn.** Above that, each zombie den's chance to spawn a horde (and how big that horde is) scales with your current noise level and your distance from that specific den — loud and close is dangerous, quiet and far is comparatively safe. Your base level also throttles overall horde frequency: a fresh, low-level base sees only a fraction of the "full" spawn rate, ramping up to normal as you level up — early game is meant to give you room to build before the pressure ramps up.

Hordes path toward the noise source (you), preferring open ground, avoiding mountains, and unable to cross water. They advance a tile at a time, fighting whatever's there — win, and the tile (and anything on it) is theirs until you retake it. A horde that severs a section of your territory from your base instantly costs you everything stored in that cut-off section, and its buildings go damaged until reconnected and repaired.

Losing the game means the base's reinforcement HP (see above) is destroyed by a horde.

---

## Zombie dens & outposts

Every **zombie den** on the map is a fixed, permanent threat — its strength is set the moment the world is generated and never changes on its own; dens further from your base are tougher. Clicking a scouted den shows its defense value and lets you send an assault party (militia/knights/snipers, same as attacking any other tile).

Clearing a den is a two-step process:
1. **Win the assault.** Beat the den's defense and you immediately claim the den tile plus a small ring around it — enough room to garrison and start building right away.
2. **Survive the hold.** The den doesn't go down quietly — over the next several minutes it throws escalating last-stand waves at whatever you've built on that ring. Garrison the core tile and get a tower or wall or two up fast; each wave is bigger than the last, so a defense that worked on wave 1 won't necessarily hold by wave 4. Lose a wave and the den reverts to hostile (unchanged level) — you'll need to assault it again from scratch, garrison and all.

Survive the full hold and the den converts into an **Outpost** — a second base. It comes with its own reinforcement HP (starting stronger if you cleared a tougher den — a real reward for a hard siege), and it has its own resource storage, entirely separate from your main stockpile: any extraction tile that connects to the outpost instead of your main base auto-flows resources into the outpost's own storage. There's currently no way to move resources from an outpost back to your main base — it's a self-sufficient second economy, not a resource funnel. Upgrading or repairing an outpost's reinforcement (or its storage) is paid out of its own stockpile, so a well-connected outpost can defend and grow itself.

Losing an outpost to a horde doesn't end the game — it just reverts back to a hostile den (one level weaker than what you originally cleared), ready to be sieged again.

---

## Current goal

Clearing dens and building up outposts is a real, playable objective today, but there's **no formal "win" yet** — no hidden win-condition tile to find and secure. The game is currently about how far you can grow your economy, defenses, and outposts, and how long you can keep your base standing against escalating pressure, before either a horde gets through or you decide to stop. Play it as an open-ended survival/builder challenge for now.

---

## Quick tips

- Build your first food/wood/stone extraction tiles immediately — you start with exactly enough for one of each.
- Don't overbuild early — your build slot cap is tight at base level 1, and every structure (even a quiet one) raises your noise floor a little.
- A tower's passive claim range is a cheap way to expand territory without spending militia.
- Keep at least a little garrison on exposed tiles once hordes start showing up — a bare tile has almost no defense of its own.
- Scouting before attacking a tile shows you its defense value, so you're not committing militia blind.
- If you're not making noise-triggering moves, hordes need real time to get moving again — recovering the "quiet" state is worth doing between pushes.
- Before assaulting a den, have your garrison/tower/wall plan ready to execute the moment you win — the last-stand hold starts immediately, and its waves escalate fast.
