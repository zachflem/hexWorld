# Hex World — Player Guide

A small group arrives in unfamiliar territory and settles in. You'll build up an economy, automate resource collection, and fortify your position — because the noise you make draws zombie hordes, and if one ever reaches your base and breaks through, the run ends. Somewhere out past the edge of the known map sits a hidden lab: find it, fight past its guardian, and you win the run outright.

This guide describes the game **as it currently plays**.

---

## Getting started

When you first open the game (or choose **Start as a new player** after wiping progress), you'll page through a short **field manual** — cover, registration, a few story pages, then a send-off — before the map loads.

On the registration page you'll enter a **name** and a **colour** (used to tint your base and territory outline on the map). Expand **Show Advanced Options** (collapsed by default) for:
- **Map size** — 32×32 (default, quick run), 64×64, 96×96, or 128×128. Larger maps have more dens and wider spacing; the same seed at different sizes is a different world. Custom difficulty profiles can **fix** map size (and seed) for authored scenarios — those fields show as read-only when locked.
- **Difficulty** — Standard (`default`) or Hard (`hard`); each profile changes balance numbers and may swap some sprites, with missing art falling back to Standard.
- **Seed** — a number that fully determines the map layout, terrain, and everything on it. Leave it blank for a random map, or enter a specific number to replay a map you (or someone else) has seen before; the same seed always generates the exact same world.
- **Recent seeds** — your last five seeds, for quick replay.

You can also open a difficulty directly via URL: `play.{domain}/hard` loads the Hard profile before onboarding.

Use **Begin**, **Continue**, **Next**, and **Step Outside** (or arrow keys on non-input pages) to move through the manual.

**Returning with a save:** if you already have progress in this browser, you'll see a notebook-style prompt first — **Continue** resumes where you left off (same profile as when you saved); **New Game** clears the save and opens the field manual for a fresh run; **Load** imports a JSON save file (replaces the local save).

Progress saves automatically in your browser (IndexedDB) as you play — closing the tab is safe.

**Save files:** open **Settings** (bottom-right gear) to **Save to file** (downloads a JSON backup) or **Load from file** (replaces the save in this browser). You can also load from the continue prompt or the field-manual cover on a fresh device — useful for moving a run between browsers or keeping backups. Files are plain JSON and may be hand-edited; there is no account sync.

### Starting a new game later

From **Settings** in the bottom-right menu, pick one of the three options directly (no extra dialog):
- **Replay the current map** — same seed, fresh start, same layout.
- **Start a new game** — a freshly-generated random seed (or type your own).
- **Start as a new player** — re-enter your name/colour from scratch.

The game-over and win screens still open a **New Game** dialog with the same three choices.

All three wipe current progress, so use them deliberately.

### Map controls

Bottom-left hex buttons: **zoom in**, **zoom out** (tap or hold to keep zooming), and **recenter on base** (keeps your current zoom). Scroll-wheel / pinch zoom still work on the map itself. The bottom-right cluster opens panels (garrisons, intelligence, personnel, research, settings). **Personnel** lists owned combat units, scout assets, and food upkeep per second; **Intelligence** shows lab clues and watchtower signals.

The top-left resource bar shows stockpile amounts; a small green/red **±** next to an amount is the live net rate per second (inflow minus upkeep; hidden when roughly zero or that resource is at cap).
---

## The world

- The map is a procedurally generated hex grid (**32×32**, **64×64**, **96×96**, or **128×128** — chosen in advanced registration; default 32), seeded from your world seed.
- **Terrain types:** grassland, forest, mountain, shore, and water. Each restricts what you can build there.
- **Transition tiles** occur where two terrain types border each other — either terrain's structures can be built there, but at **half yield**. The game won't tell you this outright; scouting one only gives a cryptic hint that "something's different" about it.
- **Fog of war:** you start with full visibility of your own territory. Beyond that, visibility fades in rings — heavily shaded just past your border, barely visible past that, and fully hidden further out. Scouted tiles reveal themselves the same way owned tiles do, but stay visually distinct (it's knowledge, not ownership).

---

## Your starting position

You begin owning your base tile plus the two full rings around it (19 tiles) outright — no claiming needed. Different seeds vary the **starting landscape** around that camp (biome mix near home), not only the far map — the same seed always settles you in the same spot. You start with enough food, wood, and stone to build one extraction tile of each of those three types, with a modest buffer left over.

---

## Resources

Four stockpile types, in ascending rarity: **food → wood → stone → steel**. Rarer resources yield less per tile and generate more noise while being gathered.

Each resource has its own **storage cap** at your base (1000 at level 1, doubling per storage upgrade level — upgraded per-resource from the base tile sheet’s **Storage** filter; first upgrade takes **2 minutes**, each further level **+50%** on that timer, and progress shows in the notification tray). Separate from the global tech tree under [Research](#research). The base sheet’s **Info** filter shows how full each stockpile is against its current cap.

**Power** is not stockpiled. Build a **power station** on owned land to cover nearby tiles with capacity. Upgrade the station for more capacity and a wider area. Level-1 buildings work anywhere without power; upgraded (level/tier 2+) buildings — including Scrap Yards — need coverage. If demand exceeds supply you’ll **brown out** (slower yield/DPS/etc.); past the cut-off they go offline (“No power”), which also freezes Scrapper progress and clears last-mile couriers.

---

## Extraction tiles

Build one on suitable land (never on water) to generate **food, wood, or stone** passively. Each has three levels — **L1 → L2 → L3** — upgraded in place, not rebuilt; higher levels yield substantially more, but cost a wider mix of resources to reach.

**Steel has no extraction tile** — see [Steel: scrap stashes & Scrap Yard](#steel-scrap-stashes--scrap-yard).

Building extraction tiles gets progressively more expensive the more of that type you already have (your 2nd food tile costs more than your 1st, and so on).

**Collecting resources:**
- **Manual collection** is always free and always available from the tile sheet. Map collect pins stay quiet until a tile's local stockpile is about **60%** full (less clutter while extractors fill). Click a pin to pull that stockpile into storage by hand.
- **Couriers** automate this once the structure is upgraded to **level 2+**. An implied courier hauls between the structure and your main base; travel time scales with route difficulty (farther / mountain-heavier sites take longer). Automated tiles hide their collect pin unless the local buffer is **full** — a nudge that base storage may need an upgrade (you'll also get a toast when hub storage and that stockpile are both full). Level 3 raises production. There are **no road / path tiles** to build.
- Orange **level badges** on structures mean an upgrade is affordable — separate from collect pins.

A tile can only hold one thing at a time — an extraction tile, a tower, a wall, a barracks, a dock, a power station, or a Scrap Yard — never a combination.

---

## Steel: scrap stashes & Scrap Yard

Steel comes from the map, not from an extractor:

1. **Scrap stashes** are placed at world-gen (at least one near your start). When scouted (Wandering Scout, tower intel, etc.) they show a grey ring and tell you remaining steel plus a vague richness hint (“sparse dump” … “looks rich”). Visiting scouts also skim a small sample into storage.
2. Build a **Scrap Yard** on owned empty land (wood + stone — no steel required to start). A **Scrapper** comes with the yard: assign it to a known stash and it walks yard → stash → yard, dumping steel into the yard’s local stockpile. You can reassign mid-route when empty, or recall it home (loaded trips keep their cargo).
3. **Collect** from the yard (tile sheet anytime; map pin once the local stockpile is ~60% full, or only when full if the yard has a courier), or upgrade the yard to **L2** so an implied courier hauls steel to base like other resources. L3 adds Auto (Scrapper picks the next closest known stash) and more capacity/speed. L2+ yards need power coverage like other upgraded structures.

Empty stashes free their hex once the steel is gone.

---

## Your base

The base is a hub, not a fighting unit — it holds your storage, tech upgrades, and base-level progression, but doesn't defend itself except through its **reinforcement HP**.

- **Base level** caps how far every other structure type can be upgraded, sets your **build slot cap** (the total number of structures you're allowed to have standing at once — 10 at level 1, +10 per level), and widens how far from your territory you're allowed to attack/claim tiles.
- **Base upgrades** cost resources and take real time — they keep counting down even while you're offline.
- **Reinforcement HP** is a separate, upgradeable pool defending the base tile itself. Upgrading or repairing it also takes real time (offline-safe). **Only one** base level upgrade, reinforcement upgrade, or reinforcement repair can run at a time — you can't stack a reinforcement job on top of a base-level upgrade. If a horde deals more damage than your current reinforcement HP (plus any garrison stationed there) can absorb, **the base falls and the run ends.** A successful defense still costs HP, so repeated assaults need repair even if none of them individually break through.
- Selecting the base opens a tile sheet: **Info** shows operational status, reinforcement HP, noise cap, and storage fill vs caps; **Upgrades** / **Storage** / **Actions** cover the usual commits.
- You can also **relocate your base** to a different owned tile once you meet the base-level requirement (costs resources and time).

---

## Defenses: Towers & Walls

- **Towers** deal ranged damage to any horde within reach, every tick, for as long as it stays in range. Both damage and range grow with tower level (levels 1–4). Building on a **mountain** extends range (+2 tiles); **forest** shortens it (−1); grassland and shore are neutral. Militia stationed on a tower's own tile add their attack power straight onto its damage. A horde lingering in a tower's range is also visibly slowed.
- **Walls** (wood → rock → steel, an upgrade path) don't fight back — they soak up horde damage via durability instead. They can only be repaired during peacetime, at a cost proportional to the damage they've taken.
- **Demolishing** any structure refunds a fixed percentage of everything you ever spent on it (build + every upgrade).
- A structure a horde captures goes **damaged** (non-functional) until you retake the tile and pay to repair it. The tile stays known — hordes don't re-fog ground you've already held.

There's no way to wall off everything — your build slot cap forces real choices about what to fortify and what to leave exposed.

---

## Barracks & units

Barracks (levels 1–4, same one-structure-per-tile rule as everything else) train combat units and build land explorers:

- **Militia** — a standing army. Feeds both your **attack power** (used to claim unowned tiles and to fight hordes automatically from a garrison) and your **defense** (adds to the base's last-stand HP pool). Idle troops at the barracks cost ongoing food upkeep; units out on expeditions/assaults or garrisoned do not (you've already paid provisions for the march). Idle units desert if you can't pay.
- **Junkyard Knights** (barracks level 2+) and **Cross-Bow Snipers** (barracks level 3+) — tougher/pricier units with their own attack/defense stats. Snipers additionally deal ranged damage to any horde within range of wherever they're garrisoned.
- **Wandering Scout** — a persistent land explorer (max 1 per barracks) built for **300 food + 200 wood** (about the cost of ten old one-shot scouts). It wanders your connected land automatically, forever, quietly revealing tiles as it roams. Shown on the map as a walking icon. There is no trainable stockpile scout and no manual one-tile reveal — fog on land clears only via Wandering Scouts (and water via Scout Skiffs).

You can **garrison** militia/knights/snipers on any owned tile — a garrison automatically attacks any horde on its own tile or a neighboring one, and stacks additively with whatever structure is on that tile. **Recalling** a garrison marches it home along the same route at half the travel time and no provisions cost — it's walking back through ground you already hold, not fighting, so nothing can be lost or tombstoned along the way.

**Expeditions:** the way you claim any unowned tile, adjacent or distant — dispatch a mixed party of militia/knights/snipers along a route through **owned or scouted** ground only (routes prefer owned corridors). Provisions are paid up front (return trip implied). The party walks tile by tile in real time and **auto-claims** each unowned scouted hex it crosses — there is no tile-defense wipe. The only full wipe on the road is a **horde** the party cannot beat (`party power < horde size`); a stronger party clears the horde with no losses. Pre-dispatch UI shows party power and wipe risk from known path hordes. Mid-march you can **Redeploy** (new destination from the party’s current hex — pay full provisions for that new leg; food already spent on the old route is not refunded) or **Recall** (march home; outbound food stays sunk, return leg free). On arrival the party waits (~3 minutes) with these **options** (pick one — or none):

- **Redeploy** — pick a new destination; the current party marches on from here (new provisions for the new leg).
- **Reinforce** — send more units from home (barracks/tower/outpost); they travel out and join the waiting party (half cost/time).
- **Garrison** — cancel the wait timer and station the party on this hex.
- **Recall** — cancel the wait timer and march home now (return already prepaid — no extra food).
- **No selection** — when the timer expires, the party is auto-recalled home the same way.

**Den / lab assaults** cannot retarget mid-march, but you can **Recall** them home to the barracks/hub they launched from (outbound food sunk; return free). Already-claimed tiles stay owned.

Those same options also appear on the destination tile’s bottom sheet under **Party orders** (click the hex). The arrival decision notification stays fully expanded with those buttons until you choose (or the countdown hits auto-recall). A wipe leaves a **tombstone** showing units lost, power, and cause.

Training militia normally queues them at your barracks over time, but you can also **rush** the queue to finish instantly for a noise spike — useful when you need bodies right now and are willing to accept the extra attention.

Towers also **passively claim territory** just by existing — every tile within a tower's range becomes owned automatically, no assault needed, as if the tower gave you a better vantage point.

---

## Docks & the water

Water tiles can't host normal extraction tiles or defenses — but you can build a **Dock** on any water tile bordering land (as long as you own or have scouted that water tile). A dock generates food (about 70% the rate of a standard food extraction tile). At **level 1** you collect manually; **level 2** unlocks an implied courier to base (same model as land extraction); **level 3** is the production upgrade (replaces the old standalone fishing-boat build).

Per dock:
- **Scout Skiff** — a mobile unit (max 1 per dock) that wanders its connected body of water forever, revealing every tile it drifts past — the water equivalent of the Wandering Scout.

Docks can't be captured by hordes (hordes can't cross water), so they're a low-risk, if modest, income source.

---

## Research

A global tech-tree panel, separate from any building or resource's own storage upgrades — only one research can run at a time. Four lines:

- **Troop Speed** — two tiers; cuts travel time for expeditions and den/lab assaults (up to 2x faster fully researched).
- **Game Speed** — two tiers; unlocks faster fast-forward multipliers for simulating ahead (1x by default; researching this unlocks 3x, then 5x).
- **Construction → Parallel Work Orders** — mid-game, **15 minutes** to research; raises every structure (and the base hub) from **one timed task at a time to two** — e.g. base level upgrade plus a storage upgrade, or a tower tier upgrade while a horde repair runs on the same tile. Garrison/recall stays instant and never consumes a slot.
- **Scouting → Improved Optics** — wandering scouts reveal the stepped tile plus its first land ring (7 tiles total; water excluded); territory expeditions free-claim unowned neighbors of every tile they step on (including water), so shoreline water can be owned from the adjacent land hex.

By default each tile (and the base hub) can only run one build/upgrade/repair timer at a time until Parallel Work Orders is researched. When a research is affordable and the slot is free, the bottom-right menu and Research hex light up orange (same cue as structure upgrade-available badges).

All lines cost resources and take real time to complete, same as any other timed upgrade.

---

## Noise & hordes — the core tension

Every structure you have contributes to an **ambient noise floor** — a steady-state level your base settles at. Building, upgrading, or repairing something spikes noise sharply above that floor, then it decays back down over a couple of minutes. More/higher-tier structures mean a higher floor; you're never fully silent once you've built anything.

**Below 30dB — your quietest possible floor — hordes have nothing to hear and simply won't spawn.** Above that, each zombie den's chance to spawn a horde (and how big that horde is) scales with your current noise level and your distance from that specific den — loud and close is dangerous, quiet and far is comparatively safe. Your base level also throttles overall horde frequency: a fresh, low-level base sees only a fraction of the "full" spawn rate, ramping up to normal as you level up — early game is meant to give you room to build before the pressure ramps up.

Hordes path toward the noise source (you), preferring open ground, avoiding mountains, and unable to cross water. They advance a tile at a time, fighting whatever's there — win, and the tile (and anything on it) is theirs until you retake it. Captured ground stays known (no re-fog); structures go damaged until you reclaim and repair. A horde that severs a section of your territory from your base instantly costs you everything stored in that cut-off section, and its buildings go damaged until reconnected and repaired.

Losing the game means the base's reinforcement HP (see above) is destroyed by a horde.

---

## Zombie dens & outposts

Every **zombie den** on the map is a fixed, permanent threat — its strength is set the moment the world is generated and never changes on its own; dens further from your base are tougher. Clicking a scouted den shows its defense value and lets you send an assault party (militia/knights/snipers, same as attacking any other tile).

Clearing a den is a two-step process:
1. **Win the assault.** Beat the den's defense and you immediately claim the den tile plus a small ring around it — enough room to garrison and start building right away.
2. **Survive the hold.** The den doesn't go down quietly — over the next several minutes it throws escalating last-stand waves at whatever you've built on that ring. Garrison the core tile and get a tower or wall or two up fast; each wave is bigger than the last, so a defense that worked on wave 1 won't necessarily hold by wave 4. Lose a wave and the den reverts to hostile (unchanged level) — you'll need to assault it again from scratch, garrison and all.

Survive the full hold and the den converts into an **Outpost** — a second base. It comes with its own reinforcement HP, starting stronger if you cleared a tougher den — a real reward for a hard siege — and it can be garrisoned and built up just like your main base. Its resources aren't separate, though: extraction tiles and Scrap Yards still courier into the **same shared stockpile** at the main base — an outpost is another foothold, not a second economy. Reinforcement upgrades and repairs on an outpost still draw from that same shared stockpile.

Losing an outpost to a horde doesn't end the game — it just reverts back to a hostile den (one level weaker than what you originally cleared), ready to be sieged again.

---

## The Hidden Lab & winning the game

Somewhere out past every zombie den — deliberately farther out than any of them — sits a **hidden lab**, guarded, and finding + securing it is the win condition. There's nothing else to do to win; you don't need to clear every den or build a particular economy size, just reach the lab and beat its guardian.

**Finding it** has two tracks that work together:

- **Watchtowers (level 2+)** sometimes pick up a vague distant **signal** ("something in the north — send the scouts"). That is not a clue — it lightly steers **Wandering Scouts** toward that sector with only a faint pull toward the lab. Level 4 towers hear signals more often. Scouts can also stumble onto the lab with no signal at all — when they do, a toast names the coordinates and the lab marker appears on that hex.
- **Clearing a den** always awards one directional **clue** (5 total). Clues refine from a rough compass quadrant relative to your base down to a narrower arc. Wandering scouts never collect clues.

Once you've secured **5 dens' worth of clues**, the map marks a **search cluster**: scouted hexes inside it get a light tint in your chosen color, and unscouted hexes there show a little more through the fog — still not the exact lab tile. Send scouts through the cluster (or keep exploring earlier) to find and assault the lab.

Watchtowers also **alert** when a horde first enters their combat range.

**Securing it** works like assaulting a den — commit a party of militia/knights/snipers. The guardian is by far the toughest fight in the game (defense rolled per world in a high band, well above even a max-level den — meant to demand a real late-game army, and different each seed), and unlike a den there's no hold period afterward: win the fight and the game ends immediately in victory. While the party is marching, a **ceremony banner** takes the top of the screen (resource bar drops below it) and a gold highlight rings the viewport — this is not a normal tray notification.

Clearing dens is never *required* to win — a lucky scout run can reveal the lab without any den clues — but dens are how you unlock the search-cluster hint, plus outposts and the army growth you'll want for the guardian.

---

## Notifications

The **top-right** of the screen shows active timers and short event messages:

- **Timer rows** — one per in-flight build, upgrade, repair, training queue, expedition, den assault, recall, or den siege hold. Each shows an icon, what it is, coordinates, and time remaining. **Rush** (where offered) finishes militia training early for a **noise spike** — it does not spend a power currency. **Lab assaults** do not appear here — they get the top-of-screen ceremony banner instead.
- **Toasts** — brief one-off notices (e.g. base upgraded, den cleared, new lab clue).

When a row appears it stays **fully expanded for 5 seconds**, then the text/countdown slides away and only the **icon** remains as a small peek along the right edge. **Tap the icon** to expand it again. Timer rows keep peeking until that action finishes; toasts fade out on their own after a short peek.

When several timers are running, collapsed icons stack in that column so you can see at a glance how much is in flight.

On the map, any building with a timed job also shows a **circular progress ring** that fills as the timer runs — amber for builds, orange for upgrades, green for repairs, purple for training, blue for base relocation. Opening that tile’s sheet lists those jobs under **In progress** (at the top of the combined action list, or via that filter) with remaining time — handy when you want the detail without hunting the notification tray.

---

## Quick tips

- Build your first food/wood/stone extraction tiles immediately — you start with exactly enough for one of each.
- Steel starts at **0** — scout for a scrap stash, build a Scrap Yard (wood + stone), and run the Scrapper before you need steel for power stations or upgrades.
- Before upgrading extractors, yards, or towers past level 1, place a **power station** nearby — otherwise L2+ buildings go offline.
- Don't overbuild early — your build slot cap is tight at base level 1, and every structure (even a quiet one) raises your noise floor a little.
- A tower's passive claim range is a cheap way to expand territory without spending militia.
- Keep at least a little garrison on exposed tiles once hordes start showing up — a bare tile has almost no defense of its own.
- Scouting a tile (via Wandering Scout / Scout Skiff) shows you its defense value before an expedition, so you're not committing militia blind.
- If you're not making noise-triggering moves, hordes need real time to get moving again — recovering the "quiet" state is worth doing between pushes.
- Before assaulting a den, have your garrison/tower/wall plan ready to execute the moment you win — the last-stand hold starts immediately, and its waves escalate fast.
- Every den you clear also hands you a guaranteed lab clue, so working toward outposts naturally works toward finding the lab too.
- Research Troop Speed early if you plan to run a lot of expeditions or den assaults — faster travel means less time exposed on the road.
