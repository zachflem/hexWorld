> **Archived (2026-07-20):** this session's fix, verification, and the save-recovery question below are all resolved — the base-tile-capture bug this document describes was fixed and regression-tested on 2026-07-12, and the "reset vs. hand-recover" decision was moot once the game was reset in later sessions. Kept for history only; nothing here reflects current open work. See `ROADMAP.md`/`DESIGN.md` for the live picture.

# Where we left off (2026-07-12)

## What just happened

You found a real bug by inspecting your own browser's IndexedDB and asking
the right question: a horde had clearly reached your base (all 12 saved
`hordes` entries had `pathIndex === path.length - 1`), which showed up as a
"line of unclaimed tiles" cutting through your starting base. You asked: if
a horde went straight through the base, shouldn't the loss condition have
triggered? Correct instinct — there is no loss condition yet (that's
Milestone 12/13), and the bug was that `advanceHordes` didn't know that, so
it silently stripped the **base tile itself** out of `territory.owned` once
a horde "captured" it, same as any other tile.

## The fix (two parts, both done and verified)

1. **`src/engine/hordes.ts`** — `advanceHordes` now has an explicit guard:
   the base tile's coordinate is never removed from `owned`, no matter what
   a horde does to it. Inline comment explains why: there's no
   reinforcement-HP/loss-condition mechanic yet to make "the base falls"
   meaningful, so for now a horde can walk onto the base and sit there, but
   can't take it.

2. **`src/render/HexCanvas.tsx`** — related rendering gap: the horde marker
   was drawn inside the `else` branch of the base/non-base tile split, so a
   horde standing exactly on the base tile was previously invisible (the
   base icon always won that branch). Horde markers now draw in a
   top-level block regardless of whether the tile is the base, so you'll
   actually be able to see a horde sitting on your base once this ships.

3. Added a new test, `src/engine/hordes.test.ts` → *"never removes the base
   tile from territory.owned, even once a horde reaches it"* — locks this
   in as a regression test.

## Verification status: all clean

Ran via WSL just now:
- `tsc -b --noEmit` — clean
- `npm test` — **22 files / 173 tests passing** (172 previous + 1 new)
- `npm run lint` (oxlint) — 0 warnings, 0 errors
- `npm run build` — succeeds, PWA precache generated fine

This is a safe, fully-verified state to resume from.

## Open question — your save file (not yet decided)

Your actual browser save currently has:
- `territory.owned` **already missing the base tile** (from before this fix
  existed — the old buggy code already ran against it)
- **12 accumulated `hordes` entries**, all sitting at/near the base

The fix stops this from getting *worse*, but it does **not** retroactively
repair a save that's already in the bad state. Two options when you pick
this back up:
- **Easiest**: just reset/start a new game (you already said you're fine
  doing this). The bug is fixed going forward, so a fresh save won't hit it.
- **Manual recovery**: if you want to keep your current save, we'd need to
  hand-edit IndexedDB via devtools — add the base coordinate back into
  `territory.owned`, and probably clear out the pile of stale hordes sitting
  on top of it so they don't immediately re-"capture" it again next tick.

I haven't touched your save either way — your call when you're back.

## Natural next steps (not started)

- Decide reset-vs-recover for the existing save (above).
- Milestone 12 is the real next chunk of design work: base reinforcement HP
  + an actual loss condition, replacing the M11 placeholder combat
  resolution in `hordeTileDefense`/`resolveHordeTileFight`. This bug is a
  good concrete example of why that milestone matters — right now "the
  base gets attacked" has no real consequence at all, good or bad.
- Everything from the earlier "M10 QA checklist" is still valid background
  if you want to re-run through it after resuming.

## Standing reminders for next session

- Always use WSL (`wsl.exe -- bash -lc '...'`) for any node/npm/tsc/vitest
  command in this environment — plain Bash/PowerShell here has no node.
- All new tunable numbers belong in `public/tweaks.jsonc`, flagged
  `_status: "first pass, untested"` like the rest of the file — never
  hardcoded in engine files.
- ROADMAP.md is the authoritative milestone source of truth if there's ever
  doubt about what's "done" vs. not (M11 = horde spawning/pathfinding/dens,
  done; M12 = tower/wall combat resolution + base HP + loss condition, not
  yet built).
