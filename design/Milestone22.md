# Milestone 22 — Onboarding Overhaul: The Field Manual

**Status:** ✅ Complete

Implementation plan and design reference for the onboarding rework. See `ROADMAP.md` for the one-line milestone entry; this file holds the detail.

## Context

The current onboarding screen (`src/ui/OnboardingScreen.tsx`) is a single unstyled `<form>`: name input, colour picker, optional seed field, one "Settle" button. It works but gives a new player zero sense of place — no hook, no explanation of what they're about to do, nothing that sells the premise (small group settling hostile territory, noise draws zombie hordes, a hidden lab holds the cure). The goal is to make first contact with the game feel like **finding an old physical field manual** — not a glowing computer terminal, since in the fiction the player hasn't built any power infrastructure yet when the run starts — read it, then head out into the world.

Requested flow, in order: brief intro/hook → enter player details (existing form, unchanged fields/validation) → several pages of diegetic story content with a page-turning mechanic → hand off into the game exactly as today. Visual language: aged paper, ink text, worn-cover framing — sepia tones, not neon/scanlines. Story portion should be short (3-4 pages), written as an in-world document the character found, not narrator exposition. Must work in both light and dark mode using the app's existing `index.css` custom-property theming pattern. No new dependencies.

## Page sequence & state

One linear array of pages inside a rewritten `OnboardingScreen.tsx`, one `pageIndex` state, one keyboard listener — not a separate form-mode/booklet-mode split.

1. **Cover** — title + one-line hook, no inputs. Primary button: "Begin".
2. **Registration** — today's form (name / colour / optional seed), same validation logic, same defaults (`DEFAULT_COLOR = "#863bff"`), just reframed as a manual page. Primary button: "Continue", disabled until name is non-empty (same gate as today's submit button).
3-6. **Story pages** (four diegetic manual/log entries — "Before You Go" included):
   - "Settling" — the group arrives and claims the ground (DESIGN.md §1/§6).
   - "The Noise" — noise draws hordes, danger scales with activity (§12).
   - "What We're Looking For" — rumor of a hidden lab holding a cure (§13), framed as legend, not exposition; lab-only win, dens optional.
   - "Before You Go" — a softened, in-fiction nudge (claim ground, stay quiet, watch the treeline) that doubles as a light tutorial without breaking the fourth wall.
   Page counter ("Page n of N") is scoped to just this subset — cover/registration/send-off don't count toward it.
7. **Send-off** — closing line + final button ("Step Outside") that calls `onCreated(player, seed)` — the only place the existing contract fires, deferred to the end instead of firing right after the form.

```ts
type OnboardingPage =
  | { kind: "cover" }
  | { kind: "registration" }
  | { kind: "story"; id: string; title: string; body: string[] }
  | { kind: "sendoff" };
```

State stays flat: `pageIndex`, plus the existing `name`/`color`/`seedInput`/`seedError` lifted unchanged into the component. No reducer — 6-7 linear pages with one validation gate doesn't need one.

**Validation/back-nav:** leaving the registration page forward re-runs the exact same seed parsing the current `handleSubmit` does (trim → blank-is-fine → integer/`>=0` check → `setSeedError`). Going back to registration from a later page is harmless — no game state exists yet to undo.

## Page-turn interaction

- Footer nav: "← Back" (hidden on cover, not just disabled), page counter (story pages only, `aria-live="polite"`), primary button (label varies: Begin / Continue / Next / send-off phrase).
- Focus moves to the primary footer button on each page change.
- Keyboard: `ArrowLeft`/`ArrowRight` advance/retreat on non-input pages (cover, story, send-off) via a `keydown` listener scoped to the mount lifetime. On the registration page, keep the existing `<form onSubmit>` for Enter-to-continue and do **not** bind the global arrow-key listener there, so typing in the name/seed inputs (cursor movement, Enter for autofill etc.) isn't hijacked.
- Transition: instant-swap with a short (~180ms) opacity/translateY fade keyed on `pageIndex`, wrapped in `@media (prefers-reduced-motion: no-preference)` so motion-sensitive users get a plain instant swap. No page-curl/flip — the rest of the app's screens (WinScreen/GameOverScreen/NewGameDialog) have zero animation, so a subtle fade is the ceiling here, not a skeuomorphic flip.

## Visual design

Anchor to `index.css`'s existing `@media (prefers-color-scheme: dark)` pattern, but scoped to a new `.onboarding-root` class with its own sepia/paper custom properties (not reusing `--bg`/`--text`/`--accent`, which are tuned for the app's purple UI chrome, not paper):

```css
.onboarding-root {
  --manual-paper: #f3ecd9;
  --manual-paper-edge: #e4d8b8;
  --manual-ink: #2b2013;
  --manual-ink-muted: #5a4d38;
  --manual-rule: rgba(43, 32, 19, 0.25);
}
@media (prefers-color-scheme: dark) {
  .onboarding-root {
    --manual-paper: #1c1712;
    --manual-paper-edge: #120e0a;
    --manual-ink: #d9cba8;
    --manual-ink-muted: #a4926c;
    --manual-rule: rgba(217, 203, 168, 0.2);
  }
}
```

- Paper surface via layered radial gradients for soft foxing/age (no image assets — `public/` only has game sprites).
- Thick darker-tone outer border (`border: 10px solid var(--manual-paper-edge)`, minimal `border-radius`) + the app's existing `--shadow` token for lift.
- Body text is explicitly `text-align: left` inside `.onboarding-root` (overrides `#root`'s centered layout).
- Registration uses a flexible field stack with a reserved `.onboarding-registration__future-slot` for a future map-size control (Milestone 21 UX #10) — no fixed card height.
- Serif font stack (`Georgia, 'Times New Roman', serif`) scoped only to `.onboarding-root` — a deliberate, scoped exception from the app's sans-serif `--heading`/`--sans`, since serif reads as "printed manual." Explicitly no monospace anywhere (that's the terminal look being avoided).
- No glow/scanline/text-shadow, no bleeding the app's purple `--accent` into this screen. The `<input type="color">` swatch on the registration page is the one intentional spot of saturated color.

## File layout

**New:**
- `src/ui/onboarding/OnboardingScreen.tsx` — orchestrator (moved from `src/ui/OnboardingScreen.tsx`, subfolder matches existing `src/ui/menu/`, `src/ui/hud/`, `src/ui/panels/` convention). Owns `pageIndex`, form state, keyboard listener.
- `src/ui/onboarding/ManualPage.tsx` — shared paper-page chrome: card framing, header, scrollable body, footer nav (prev/next/counter). Cover/registration/story/send-off all render inside this.
- `src/ui/onboarding/onboardingContent.ts` — content-only: `STORY_PAGES` array, cover hook line, send-off line. Keeps prose out of component logic.
- `src/ui/onboarding/onboarding.css` — the one dedicated stylesheet (imported once from `OnboardingScreen.tsx`): `@keyframes` fade, paper-texture gradients, the light/dark custom properties above.

**Modified:**
- `src/App.tsx` — only the import path changes (`./ui/onboarding/OnboardingScreen` instead of `./ui/OnboardingScreen`); the render gate (`<OnboardingScreen onCreated={handlePlayerCreated} />`, only rendered when no saved game exists) and `handlePlayerCreated` (`await resetGame(player, seed ?? generateSeed())`) are untouched — contract (`onCreated(player, seed?)` fired exactly once) is identical.
- `design/ROADMAP.md` — Milestone 22 marked complete.
- `design/DESIGN.md` §4 — field-manual onboarding flow.
- `design/PLAYER_GUIDE.md` — getting-started section updated for the manual flow.

**Removed:** old `src/ui/OnboardingScreen.tsx` (superseded by the subfolder version, not left orphaned).

## Verification

Manual click-through against `npm run dev` (dev server run by the user, not started by Claude):
1. Fresh IndexedDB (private window / clear storage) → confirm cover renders first, click/key through registration (validation matches today's behavior exactly: empty name blocks advance, bad seed text shows the same error) → story pages (counter increments correctly) → send-off → confirm the app enters `GameScreen` with the entered name/colour/seed actually applied, and a supplied seed reproduces the same map on reload.
2. Keyboard nav: arrow keys advance/retreat on non-input pages; confirm they're inert while a text input on the registration page has focus (no hijacking cursor movement).
3. Toggle `prefers-color-scheme` (devtools → Rendering → Emulate CSS media) → confirm paper tones swap correctly in both modes with legible contrast.
4. Existing save (from step 1) → reload → onboarding never renders, `GameScreen` appears immediately.
5. Emulate `prefers-reduced-motion: reduce` → pages swap instantly, no fade, still fully functional.
