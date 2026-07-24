# Milestone 16 — UI Polish Pass

**Status:** Partial (in progress)  
**GitHub:** https://github.com/zachflem/hexWorld/milestone/17 · Issues [#64](https://github.com/zachflem/hexWorld/issues/64), [#38](https://github.com/zachflem/hexWorld/issues/38), [#39](https://github.com/zachflem/hexWorld/issues/39)

## Context

Much of the original M16 UI polish scope was superseded by M20. Remaining leftovers: watchtower intel/alert role (#38 / legacy #P3) and PWA install screenshots (#39 / #P7).

## #39 — PWA manifest screenshots (shipped)

Wide (1280×720) and narrow (720×1280) screenshots for cover, setup, and gameplay under `public/screenshots/`, wired in `vite.config.ts` for Chrome’s richer install UI.

## #38 — Watchtower intel & alerts

**Player fantasy:** towers **listen**; wandering scouts **investigate**.

- L1 towers: combat only.
- L2–L3: rare tick roll → vague 4-point **signal** toast (does not increment `cluesCollected`).
- L4: higher signal chance via `watchtower_intel_tier_multiplier`.
- Active signal biases [`advanceWanderingScouts`](../src/engine/wanderingScouts.ts); newly scouted tiles in that sector can award a **real** lab clue (clears signal).
- Horde entering an active tower’s combat range → early-warning toast (session dedupe until leave).

Out of scope for this pass: DESIGN §11 twelve-tier intel-depth / progressive tile-info UI.

### Implementation map

- `src/data/lab.ts` — `watchtowerSignal` on `LabRecord`
- `src/engine/lab.ts` — `rollWatchtowerSignal`, compass helpers, toast copy
- `src/engine/wanderingScouts.ts` — bearing-weighted steps + sector clue rolls
- `src/App.tsx` — tick wiring + horde alerts
- `src/ui/panels/ScoutingPanel.tsx` — active signal line

### Acceptance

- [ ] L2+ tower can produce a distant-signal toast; L1 never does
- [ ] Wandering scouts drift into the signal sector and can surface a real clue there
- [ ] Manual scout + den-clear clues unchanged
- [ ] Horde entering tower range shows an alert toast
