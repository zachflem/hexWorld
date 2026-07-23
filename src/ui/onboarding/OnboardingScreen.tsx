import { useCallback, useEffect, useMemo, useState } from "react";
import type { Tweaks } from "../../data/tweaksSchema";
import type { MapSizeOption } from "../../data/mapSize";
import {
  DEFAULT_MAP_SIZE,
  isMapSizeOption,
  isProfileGridSizeLocked,
  isProfileSeedLocked,
  MAP_SIZE_OPTIONS,
} from "../../data/mapSize";
import type { Player } from "../../data/player";
import { loadProfile, type ProfileEntry } from "../../data/profileRegistry";
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

export type OnboardingResult = {
  player: Player;
  seed?: number;
  profileSlug: string;
  gridSize: MapSizeOption;
};

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
  profiles,
  initialProfileSlug,
  recentSeeds,
  onCreated,
}: {
  profiles: ProfileEntry[];
  initialProfileSlug: string;
  recentSeeds: number[];
  onCreated: (result: OnboardingResult) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [profileSlug, setProfileSlug] = useState(initialProfileSlug);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gridSize, setGridSize] = useState<MapSizeOption>(DEFAULT_MAP_SIZE);
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const [pendingSeed, setPendingSeed] = useState<number | undefined>(undefined);
  const [pendingProfileSlug, setPendingProfileSlug] = useState(initialProfileSlug);
  const [pendingGridSize, setPendingGridSize] = useState<MapSizeOption>(DEFAULT_MAP_SIZE);
  const [profileTweaks, setProfileTweaks] = useState<Tweaks | null>(null);

  const trimmedName = name.trim();
  const page = PAGES[pageIndex];

  const selectedProfile = profiles.find((p) => p.slug === profileSlug);
  const gridSizeLocked = profileTweaks != null && isProfileGridSizeLocked(profileTweaks);
  const seedLocked = profileTweaks != null && isProfileSeedLocked(profileTweaks);
  const profileGridSize = profileTweaks?.game.grid_size ?? DEFAULT_MAP_SIZE;
  const profileSeed = profileTweaks?.game.world_seed;

  useEffect(() => {
    let cancelled = false;
    void loadProfile(profileSlug)
      .then((tweaks) => {
        if (!cancelled) setProfileTweaks(tweaks);
      })
      .catch(() => {
        if (!cancelled) setProfileTweaks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profileSlug]);

  useEffect(() => {
    if (profileTweaks == null) return;
    if (isProfileGridSizeLocked(profileTweaks) && isMapSizeOption(profileTweaks.game.grid_size)) {
      setGridSize(profileTweaks.game.grid_size);
    }
    if (profileTweaks.game.world_seed != null) {
      setSeedInput(String(profileTweaks.game.world_seed));
      setSeedError(null);
    }
  }, [profileTweaks]);

  const primaryLabel = useMemo(() => {
    if (page.kind === "cover") return "Begin";
    if (page.kind === "registration") return "Continue";
    if (page.kind === "sendoff") return "Step Outside";
    return "Next";
  }, [page.kind]);

  function applySeed(seed: number) {
    if (seedLocked) return;
    setSeedInput(String(seed));
    setSeedError(null);
    setAdvancedOpen(true);
  }

  const validateRegistration = useCallback((): boolean => {
    if (!trimmedName) return false;
    if (profileTweaks == null) return false;

    let resolvedSeed: number | undefined;
    if (seedLocked) {
      resolvedSeed = profileSeed;
      setSeedError(null);
    } else {
      const seedResult = parseSeedInput(seedInput);
      if (!seedResult.ok) {
        setSeedError(seedResult.error);
        return false;
      }
      resolvedSeed = seedResult.seed;
      setSeedError(null);
    }

    setPendingPlayer({ name: trimmedName, color });
    setPendingSeed(resolvedSeed);
    setPendingProfileSlug(profileSlug);
    setPendingGridSize(gridSize);
    return true;
  }, [trimmedName, color, seedInput, profileSlug, gridSize, profileTweaks, seedLocked, profileSeed]);

  const goForward = useCallback(() => {
    if (page.kind === "registration") {
      if (!validateRegistration()) return;
    }
    if (page.kind === "sendoff") {
      if (!pendingPlayer) return;
      onCreated({ player: pendingPlayer, seed: pendingSeed, profileSlug: pendingProfileSlug, gridSize: pendingGridSize });
      return;
    }
    setPageIndex((index) => Math.min(index + 1, PAGES.length - 1));
  }, [page.kind, validateRegistration, pendingPlayer, pendingSeed, pendingProfileSlug, pendingGridSize, onCreated]);

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
          primaryDisabled={!trimmedName || profileTweaks == null}
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

            <div className="onboarding-registration__advanced">
              <button
                type="button"
                className="onboarding-registration__advanced-toggle"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                {advancedOpen ? "Hide Advanced Options" : "Show Advanced Options"}
              </button>

              {advancedOpen ? (
                <div className="onboarding-registration__advanced-panel">
                  <div className="onboarding-registration__field">
                    <label htmlFor="difficulty-profile">Difficulty</label>
                    <select
                      id="difficulty-profile"
                      className="onboarding-registration__select"
                      value={profileSlug}
                      onChange={(event) => setProfileSlug(event.target.value)}
                    >
                      {profiles.map((profile) => (
                        <option key={profile.slug} value={profile.slug}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    {selectedProfile?.description ? (
                      <p className="onboarding-registration__hint">{selectedProfile.description}</p>
                    ) : null}
                  </div>

                  <div className="onboarding-registration__field">
                    <label htmlFor="map-size">Map size</label>
                    {gridSizeLocked ? (
                      <p className="onboarding-registration__hint" id="map-size">
                        Fixed by this profile: {profileGridSize}×{profileGridSize}
                      </p>
                    ) : (
                      <>
                        <select
                          id="map-size"
                          className="onboarding-registration__select"
                          value={gridSize}
                          onChange={(event) => setGridSize(Number(event.target.value) as MapSizeOption)}
                        >
                          {MAP_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}×{size}
                            </option>
                          ))}
                        </select>
                        <p className="onboarding-registration__hint">
                          Smaller maps have fewer dens and shorter travel distances — good for a quicker run.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="onboarding-registration__field">
                    <label htmlFor="world-seed">Seed (optional)</label>
                    <input
                      id="world-seed"
                      type="text"
                      inputMode="numeric"
                      value={seedInput}
                      disabled={seedLocked}
                      onChange={(event) => {
                        setSeedInput(event.target.value);
                        setSeedError(null);
                      }}
                      placeholder="Leave blank for a random map"
                    />
                    {seedLocked ? (
                      <p className="onboarding-registration__hint">
                        Fixed by this profile — seed {profileSeed}.
                      </p>
                    ) : (
                      <p className="onboarding-registration__hint">
                        Share the same seed with someone else to both explore the identical map — no
                        multiplayer, just the same layout.
                      </p>
                    )}
                    {!seedLocked && recentSeeds.length > 0 ? (
                      <div className="onboarding-registration__recent-seeds">
                        <p className="onboarding-registration__hint">Recent seeds:</p>
                        <div className="onboarding-registration__recent-seeds-list">
                          {recentSeeds.map((seed) => (
                            <button
                              key={seed}
                              type="button"
                              className="onboarding-manual__btn onboarding-registration__seed-chip"
                              onClick={() => applySeed(seed)}
                            >
                              {seed}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {seedError ? (
                      <p className="onboarding-registration__error" role="alert">
                        {seedError}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
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
