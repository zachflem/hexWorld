import { useCallback, useEffect, useMemo, useState } from "react";
import type { Player } from "../../data/player";
import { ManualPage } from "./ManualPage";
import { InlineColorPicker } from "./InlineColorPicker";
import {
  COVER_HOOK,
  COVER_TITLE,
  SENDOFF_LINE,
  STORY_PAGES,
  STORY_PAGE_COUNT,
} from "./onboardingContent";
import { parseSeedInput } from "./parseSeedInput";
import "./onboarding.css";

const DEFAULT_COLOR = "#863bff";

type OnboardingPage =
  | { kind: "cover" }
  | { kind: "registration" }
  | { kind: "story"; id: string; title: string; body: readonly string[] }
  | { kind: "sendoff" };

const PAGES: OnboardingPage[] = [
  { kind: "cover" },
  { kind: "registration" },
  ...STORY_PAGES.map((page) => ({
    kind: "story" as const,
    id: page.id,
    title: page.title,
    body: page.body,
  })),
  { kind: "sendoff" },
];

function storyIndexForPageIndex(pageIndex: number): number | undefined {
  const page = PAGES[pageIndex];
  if (page?.kind !== "story") return undefined;
  const storyPagesBefore = PAGES.slice(0, pageIndex + 1).filter((p) => p.kind === "story").length;
  return storyPagesBefore;
}

export function OnboardingScreen({
  onCreated,
}: {
  onCreated: (player: Player, seed?: number) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const [pendingSeed, setPendingSeed] = useState<number | undefined>(undefined);

  const trimmedName = name.trim();
  const page = PAGES[pageIndex];

  const primaryLabel = useMemo(() => {
    if (page.kind === "cover") return "Begin";
    if (page.kind === "registration") return "Continue";
    if (page.kind === "sendoff") return "Step Outside";
    return "Next";
  }, [page.kind]);

  const validateRegistration = useCallback((): boolean => {
    if (!trimmedName) return false;

    const seedResult = parseSeedInput(seedInput);
    if (!seedResult.ok) {
      setSeedError(seedResult.error);
      return false;
    }

    setSeedError(null);
    setPendingPlayer({ name: trimmedName, color });
    setPendingSeed(seedResult.seed);
    return true;
  }, [trimmedName, color, seedInput]);

  const goForward = useCallback(() => {
    if (page.kind === "registration") {
      if (!validateRegistration()) return;
    }
    if (page.kind === "sendoff") {
      if (!pendingPlayer) return;
      onCreated(pendingPlayer, pendingSeed);
      return;
    }
    setPageIndex((index) => Math.min(index + 1, PAGES.length - 1));
  }, [page.kind, validateRegistration, pendingPlayer, pendingSeed, onCreated]);

  const goBack = useCallback(() => {
    setPageIndex((index) => Math.max(index - 1, 0));
  }, []);

  useEffect(() => {
    if (page.kind === "registration") return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "ArrowLeft" && pageIndex > 0) {
        event.preventDefault();
        goBack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page.kind, pageIndex, goForward, goBack]);

  function handleRegistrationSubmit(event: React.FormEvent) {
    event.preventDefault();
    goForward();
  }

  const storyPageIndex = storyIndexForPageIndex(pageIndex);

  return (
    <section className="onboarding-root">
      {page.kind === "cover" ? (
        <ManualPage
          pageKey={pageIndex}
          showBack={false}
          onBack={goBack}
          primaryLabel={primaryLabel}
          onPrimary={goForward}
        >
          <h1 className="onboarding-cover__title">{COVER_TITLE}</h1>
          <p className="onboarding-cover__hook">{COVER_HOOK}</p>
        </ManualPage>
      ) : null}

      {page.kind === "registration" ? (
        <ManualPage
          title="Who leads?"
          pageKey={pageIndex}
          showBack
          onBack={goBack}
          primaryLabel={primaryLabel}
          onPrimary={goForward}
          primaryDisabled={!trimmedName}
        >
          <form className="onboarding-registration" onSubmit={handleRegistrationSubmit}>
            <div className="onboarding-registration__field">
              <label htmlFor="player-name">Name</label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={32}
                autoFocus
              />
            </div>
            <div className="onboarding-registration__field">
              <label id="player-color-label">Colour</label>
              <InlineColorPicker
                id="player-color"
                aria-labelledby="player-color-label"
                value={color}
                onChange={setColor}
              />
            </div>
            <div className="onboarding-registration__field">
              <label htmlFor="world-seed">Seed (optional)</label>
              <input
                id="world-seed"
                type="text"
                inputMode="numeric"
                value={seedInput}
                onChange={(event) => {
                  setSeedInput(event.target.value);
                  setSeedError(null);
                }}
                placeholder="Leave blank for a random map"
              />
              <p className="onboarding-registration__hint">
                Share the same seed with someone else to both explore the identical map — no
                multiplayer, just the same layout.
              </p>
              {seedError ? (
                <p className="onboarding-registration__error" role="alert">
                  {seedError}
                </p>
              ) : null}
            </div>
            <div className="onboarding-registration__future-slot" aria-hidden="true" />
          </form>
        </ManualPage>
      ) : null}

      {page.kind === "story" ? (
        <ManualPage
          title={page.title}
          pageKey={pageIndex}
          showBack
          onBack={goBack}
          primaryLabel={primaryLabel}
          onPrimary={goForward}
          storyPageIndex={storyPageIndex}
          storyPageCount={STORY_PAGE_COUNT}
        >
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </ManualPage>
      ) : null}

      {page.kind === "sendoff" ? (
        <ManualPage
          title="Last page"
          pageKey={pageIndex}
          showBack
          onBack={goBack}
          primaryLabel={primaryLabel}
          onPrimary={goForward}
          primaryDisabled={!pendingPlayer}
        >
          <p>{SENDOFF_LINE}</p>
        </ManualPage>
      ) : null}
    </section>
  );
}
