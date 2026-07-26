# Milestone 15 — Hidden Lab & Win Condition

**Status:** ✅ Complete  
**GitHub:** https://github.com/zachflem/hexWorld/milestone/16 · Issues [#63](https://github.com/zachflem/hexWorld/issues/63), [#37](https://github.com/zachflem/hexWorld/issues/37) (closed via [#38](https://github.com/zachflem/hexWorld/issues/38))

## Context

Ship the hidden lab as the sole win condition: place it, surface directional clues, fight the guardian, show the win screen. Dens help (guaranteed clues, outposts, army) but never gate victory.

The original “watchtower drips clues on tick” leftover (#37) was **redesigned and completed** as watchtower **signals** + wandering-scout bias (#38), not abandoned.

## Scope (shipped)

| Piece | Deliverable |
|-------|-------------|
| Lab placement | Seeded single tile (`createLab`), min distance beyond dens, no water/den overlap |
| Scout clues | ~~Passive roll on newly revealed wandering-scout tiles~~ — **removed 2026-07-26**; scouts reveal fog / lab hex only |
| Den-clear clues | Guaranteed +1 clue on successful den hold (sole source of the 5 clues) |
| Watchtower leftover | L2+ distant **signal** (not a clue); steers wandering scouts + pulls toward lab; L4 higher chance; horde-in-range alert toast |
| Guardian fight | One-shot vs `LabRecord.guardianDefense` (rolled from `guardian_defense_min`..`max`); win → `lab.secured` + `gameStatus.won` / `WinScreen` |
| Lab-only win | Dens not required |
| Final search cluster | After all clues: map highlight via `labSearchZoneCenter` / `labSearchZoneTileKeys` (player-color wash on scouted; eased fog on unscouted) |

## Implementation map

- `src/data/lab.ts` — `LabRecord`, `createLab`, `watchtowerSignal`
- `src/engine/lab.ts` — assault, clue text, watchtower signal rolls, search-zone center/keys
- `src/engine/wanderingScouts.ts` — fog reveal; signal biases steps + lab pull (no clue awards)
- `src/App.tsx` — tick wiring (signals, den-clear clues, lab assault → win)
- `src/render/HexCanvas.tsx` — search-zone overlays; dev Lab preview modes
- `src/ui/WinScreen.tsx` / `src/data/gameStatus.ts` — win state
- `src/ui/panels/ScoutingPanel.tsx` — clue history + active signal
- `src/ui/panels/DevToolsPanel.tsx` — DEV cycle Off / Show hint / Reveal lab

## Acceptance

- [x] Locate and secure the lab without clearing any den → win screen
- [x] Clearing a den still awards its clue and converts to outpost
- [x] Watchtowers contribute via signals (not direct clue drip on tick)
- [x] After all clues, the map marks a search cluster that is not the exact lab tile
- [x] Docs (`DESIGN.md` §13, `PLAYER_GUIDE.md`, `TWEAKS.md`) match shipped behavior

## Out of scope / follow-ups

- DESIGN §11 twelve-tier progressive tile-intel UI (still aspirational)
- Clue/signal rate balance (tweaks remain first-pass numbers)
- DEV-only Lab preview tools (playtest helpers, not player-facing)
