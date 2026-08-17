# Milestone 17 — Offline Resilience & Save Files

**Status:** ✅ Complete  
**GitHub:** https://github.com/zachflem/hexWorld/milestone/18 · Issues [#65](https://github.com/zachflem/hexWorld/issues/65), [#40](https://github.com/zachflem/hexWorld/issues/40), [#41](https://github.com/zachflem/hexWorld/issues/41)

## Context

Long offline catch-up and IndexedDB auto-save recovery already shipped. Remaining work is the explicit **save-to-file / load-from-file** path described in DESIGN.md §17: plain JSON, human-editable, no accounts, no anti-tamper.

## Scope

| Issue | Deliverable |
|-------|-------------|
| #40 | Download current session as a JSON file from Settings |
| #41 | Load a JSON save via file picker (Settings, continue prompt, onboarding cover) |
| #65 | Milestone acceptance: file round-trip restores matching state on a fresh profile |

Out of scope: encryption, cloud sync, multi-save slots, save version migrations beyond rejecting unknown envelope versions.

## Save file format (`hexworld-save` v1)

```ts
{
  format: "hexworld-save",
  version: 1,
  exportedAt: number,       // epoch ms
  profileSlug: string,      // difficulty profile used for tweaks/assets
  keys: {                   // same IndexedDB key names as the live session
    player, world, territory, resources, clock, storageLevels, /* … */
    barracks,               // GameState.barracksList
    profileSlug,
    …
  }
}
```

- **Defensive parse only** — require envelope fields + the six completeness keys (`hasCompleteSave`). Optional keys default via existing `buildGameState` migrations.
- Hand-edited saves are allowed; invalid JSON / wrong format / incomplete required keys show an alert and abort.

## UI entry points

1. **Settings** — Save to file / Load from file (confirm replace when a session exists).
2. **Continue prompt** — Load from file (confirm replace).
3. **Onboarding cover** — Load from file (no confirm; fresh browser has nothing to overwrite).

## Implementation map

- `src/data/gamePersistence.ts` — envelope build/parse, download, file picker, write-through to IndexedDB
- `src/App.tsx` — export from live `GameState`; import → IDB → `buildGameState` → `ready`
- `src/ui/panels/SettingsPanel.tsx`, `ContinueGamePrompt.tsx`, onboarding cover (`ManualPage` left action)

## Acceptance

- [x] From an in-progress game, **Save to file** downloads a `.json` named with player / seed / date
- [x] On a clean browser profile, **Load from file** (cover or Settings) restores player, seed, profile, and play state
- [x] Loading while a local save exists asks for confirmation, then replaces IndexedDB + in-memory session
- [x] Bad files (non-JSON, wrong format, missing required keys) are rejected with a readable alert
- [x] Unit tests cover round-trip parse and filename suggestion
