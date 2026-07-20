> **Superseded — for historical reference only.** This is an early concept pass, written before `DESIGN.md` existed. It's since drifted out of sync in real ways — notably, it describes no win condition ("There's no 'win' state in Phase 1"), while `DESIGN.md` §13 defines one (clear every den, then find and secure the hidden lab). `DESIGN.md` is the authoritative design reference; `ROADMAP.md` tracks build order/status. Treat anything here that conflicts with those two as outdated.

# Hex World — Phase 1 Overview

## Core Concept

**Hex World** is an offline-first, single-player hex strategy game about survival and resource management. You claim territory, build infrastructure, and defend your base against procedurally-spawned zombie hordes. The game runs entirely offline on your device—no internet required.

---

## Core Gameplay Loop

**Expand → Build → Defend → Repeat**

1. **Scout & Claim:** Discover procedurally-generated map tiles, scout for intel, claim territory adjacent to your base
2. **Extract:** Deploy extraction workers (farms, hunters, fisheries, miners) on claimed tiles to gather resources
3. **Automate:** Build infrastructure paths to turn manual collection into passive resource trickles
4. **Fortify:** Build walls and towers to defend your expanding territory from incoming hordes
5. **Upgrade:** Spend resources to upgrade your base, extraction workers, and defensive structures
6. **Survive:** Manage noise levels to avoid attracting massive hordes that can destroy your territory

---

## Key Systems

### Resource Economy
Five resource types (food, wood, stone, steel, power) with varying scarcity. Each has extraction chains: small-scale (manual), mid-scale (semi-automated), and large-scale (highly automated but expensive/noisy). Higher-tier extraction generates more resources but also more noise, attracting hordes.

### Territory & Infrastructure
You own hexes radiating from your base. Claimed hexes can hold extraction workers, defensive structures, or infrastructure paths. Paths automate resource collection—goat tracks trickle resources slowly, stone roads flow faster, highways nearly eliminate travel time. The longer your supply lines, the more infrastructure you need to build.

### Noise & Horde Mechanics
Every action creates noise: gathering resources, building structures, repairing walls. The more noise you generate, the higher the chance a horde spawns, and the larger that horde becomes. This creates a core tension: expand aggressively and risk catastrophe, or play conservatively and grow slowly.

### Defense Strategy
Hordes advance toward your base tile-by-tile. Towers thin the horde as it approaches (dealing damage each turn). Walls slow the advance and absorb damage. But you can never wall off completely—you must choose where to defend, allowing hordes through other routes. A bisecting horde can cut off territory, making those resources inaccessible and disconnecting buildings from your base.

### Base & Progression
Your base is your lifeblood. Upgrade it to unlock new building rings (more tiles to work with), increase storage capacity, boost base durability, and reinforce defenses. Base level caps all other upgrades—you can't out-level your foundation.

---

## Core Tensions

**Noise vs. Growth:** Ambitious players generate noise faster and attract bigger hordes. Defensive players hoard resources slowly.

**Defense vs. Economy:** Building walls and towers is expensive and noisy. Every defensive structure is a tile you're not using for extraction.

**Connectivity vs. Risk:** Expanding far from base means longer supply lines and more territory for hordes to cut through. Staying close is safe but limits growth.

**Automation vs. Cost:** Infrastructure paths automate collection but require significant upfront investment in materials and noise.

---

## Goal & Loss Conditions

There's no "win" state in Phase 1—just survival and expansion. You lose when:
- A horde destroys your base tile (via durability damage)
- You surrender voluntarily

The game becomes about how long you can survive and how large an empire you can build before a catastrophic horde wipes you out.

---

## Why Offline-First?

No internet dependency means you play anywhere, anytime. No cloud syncing, no server downtime, no forced connectivity. The game state lives on your device, persists in your browser (PWA), and stays entirely under your control.
