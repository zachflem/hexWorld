import { useState } from "react";
import type { Player } from "../data/player";
import type { ProfileEntry } from "../data/profileRegistry";

const DEFAULT_COLOR = "#863bff";

export type OnboardingResult = {
  player: Player;
  seed?: number;
  profileSlug: string;
};

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
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [profileSlug, setProfileSlug] = useState(initialProfileSlug);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const trimmedName = name.trim();

  function applySeed(seed: number) {
    setSeedInput(String(seed));
    setSeedError(null);
    setAdvancedOpen(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmedName) return;

    const trimmedSeed = seedInput.trim();
    if (trimmedSeed === "") {
      onCreated({ player: { name: trimmedName, color }, profileSlug });
      return;
    }
    const parsedSeed = Number(trimmedSeed);
    if (!Number.isInteger(parsedSeed) || parsedSeed < 0) {
      setSeedError("Seed must be a whole number");
      return;
    }
    onCreated({ player: { name: trimmedName, color }, seed: parsedSeed, profileSlug });
  }

  return (
    <section>
      <h1>Hex World</h1>
      <p>A small group arrives in unfamiliar territory. Who leads them?</p>
      <form onSubmit={handleSubmit}>
        <div>
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
        <div>
          <label htmlFor="player-color">Colour</label>
          <input
            id="player-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? "Hide Advanced Options" : "Show Advanced Options"}
          </button>
        </div>

        {advancedOpen && (
          <div style={{ marginTop: "0.75rem", paddingLeft: "0.25rem" }}>
            <div>
              <label htmlFor="difficulty-profile">Difficulty</label>
              <select
                id="difficulty-profile"
                value={profileSlug}
                onChange={(event) => setProfileSlug(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.slug} value={profile.slug}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {profiles.find((p) => p.slug === profileSlug)?.description && (
                <p style={{ opacity: 0.85, fontSize: "0.9rem", marginTop: "0.35rem" }}>
                  {profiles.find((p) => p.slug === profileSlug)?.description}
                </p>
              )}
            </div>

            <div style={{ marginTop: "0.75rem" }}>
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
              <p style={{ opacity: 0.85, fontSize: "0.9rem" }}>
                Share the same seed with someone else to both explore the identical map — no multiplayer, just the
                same layout.
              </p>
              {recentSeeds.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>Recent seeds:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {recentSeeds.map((seed) => (
                      <button key={seed} type="button" onClick={() => applySeed(seed)}>
                        {seed}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {seedError && <p role="alert">{seedError}</p>}
            </div>
          </div>
        )}

        <button type="submit" disabled={!trimmedName} style={{ marginTop: "1rem" }}>
          Settle
        </button>
      </form>
    </section>
  );
}
