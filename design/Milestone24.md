# Milestone 24 — Per-level structure sprites (code first)

**Status:** Code path complete — art drop-in is content authoring, not a code gate.  
**GitHub:** https://github.com/zachflem/hexWorld/issues/67 (`#P13`)

Implementation plan for level/tier-aware structure sprite resolution with missing-file fallback to today’s unlevelled assets. See `ROADMAP.md` for the one-line milestone entry.

## Context

Walls and paths already use tier filenames (`wall-small|medium|large`, `path-track|stone|highway`). Towers, barracks, base, extraction, and docks shared one sprite across upgrade levels. This milestone extends the wall/path pattern: try a levelled (or tiered) filename first, then the unlevelled default, each through the existing profile → default URL chain. Partial packs stay valid — shipping no new PNGs changes nothing visually.

## Naming convention

| Kind | Variant stem | Fallback |
|------|--------------|----------|
| Tower | `tower-{1..4}` | `tower` |
| Barracks | `barracks-{1..4}` | `barracks` |
| Base | `base-{n}` (any level) | `base` |
| Extraction | `{resource}-{small\|mid\|large}` (e.g. `food-small`, `wood-mid`) | `extraction-{tier}`, then `extraction`, then **resource** icon |
| Dock + boat | `dock-boat` when fishing boat present | `dock` |
| Walls / paths | existing `wall-*` / `path-*` | unchanged |
| Den / outpost / construction / lab | single file | unchanged |

Exact level only (no nearest-lower). Canvas level badges stay drawn overlays, not part of the PNG.

### Per-variant placement

Map scale / vertical offset are tuned in [`src/render/structurePlacement.ts`](../src/render/structurePlacement.ts):

- `STRUCTURE_PLACEMENT` — per-kind defaults (`tower`, `base`, …)
- `STRUCTURE_VARIANT_PLACEMENT` — per sprite stem (`tower-2`, `food-small`, `dock-boat`, `wall-medium`, …)

Lookup: variant stem → kind default. HexCanvas passes the stem that matches the sprite name in use.

### Fallback URL order

For candidates `["tower-2", "tower"]` on profile `hard`:

1. `/profiles/hard/assets/structures/tower-2.png`
2. `/profiles/default/assets/structures/tower-2.png`
3. `/profiles/hard/assets/structures/tower.png`
4. `/profiles/default/assets/structures/tower.png`

## File layout

**New:**
- `src/render/structureSprites.ts` — pure naming helpers + URL flattening
- `src/render/structureSprites.test.ts`
- `design/Milestone24.md` (this file)

**Touched:**
- `src/render/tileTextures.ts` — `getStructureIconTextureCandidates`
- `src/render/HexCanvas.tsx` — level/tier-aware map draw
- `src/render/structurePlacement.ts` — `extraction` placement key
- `src/ui/GameScreen.tsx` — `StructureIcon` with `<img onError>` candidate walk
- `design/ROADMAP.md`, `design/DESIGN.md`, `design/TWEAKS.md`, `design/attribution.md`

## Art drop-in (after code)

Place PNGs under `public/profiles/default/assets/structures/` using the stems above (e.g. `tower-2.png`, `extraction-mid.png`, `dock-boat.png`). Hard-refresh the browser (asset cache). Update [attribution.md](attribution.md) when source/license is confirmed. Profile packs may override a subset under `public/profiles/{slug}/assets/structures/`.

## Verification

- `npm test` / `npm run build`
- Manual: map + UI still show current unlevelled sprites with **no** new PNGs
- Sanity: drop a temporary `tower-2.png` → L2 towers and UI pick it up; remove → falls back to `tower.png`
