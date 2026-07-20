import { useState } from "react";
import type { Player } from "../data/player";

const DEFAULT_COLOR = "#863bff";

export function OnboardingScreen({ onCreated }: { onCreated: (player: Player, seed?: number) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);

  const trimmedName = name.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmedName) return;

    const trimmedSeed = seedInput.trim();
    if (trimmedSeed === "") {
      onCreated({ name: trimmedName, color });
      return;
    }
    const parsedSeed = Number(trimmedSeed);
    if (!Number.isInteger(parsedSeed) || parsedSeed < 0) {
      setSeedError("Seed must be a whole number");
      return;
    }
    onCreated({ name: trimmedName, color }, parsedSeed);
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
        <div>
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
          <p>Share the same seed with someone else to both explore the identical map — no multiplayer, just the same layout.</p>
          {seedError && <p role="alert">{seedError}</p>}
        </div>
        <button type="submit" disabled={!trimmedName}>
          Settle
        </button>
      </form>
    </section>
  );
}
