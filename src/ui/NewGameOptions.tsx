import { useState } from "react";
import { generateSeed } from "../data/world";
import { SheetButton } from "./primitives/SheetButton";

export type NewGameChoice = "replay" | "newSeed" | "newPlayer";

/**
 * Shared new-game choice form — Settings embeds it inline; NewGameDialog wraps
 * it in a modal for win/lose screens. App.tsx reset handlers stay the source
 * of truth for wiping/rebuilding persisted state.
 */
export function NewGameOptions({
  currentSeed,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onCancel,
  confirmLabel = "Confirm",
}: {
  currentSeed: number;
  onReplayCurrent: () => void;
  onStartNewSeed: (seed: number) => void;
  onNewPlayer: () => void;
  /** Shown as a secondary action (Settings close / modal dismiss). */
  onCancel?: () => void;
  confirmLabel?: string;
}) {
  const [choice, setChoice] = useState<NewGameChoice>("replay");
  const [seedInput, setSeedInput] = useState(() => String(generateSeed()));
  const [seedError, setSeedError] = useState<string | null>(null);

  function handleConfirm() {
    // Validate seed before the discard confirm so a typo doesn't trigger a scary popup first.
    let nextSeed: number | null = null;
    if (choice === "newSeed") {
      const trimmed = seedInput.trim();
      if (trimmed === "") {
        nextSeed = generateSeed();
      } else {
        const parsed = Number(trimmed);
        if (!Number.isInteger(parsed) || parsed < 0) {
          setSeedError("Seed must be a whole number");
          return;
        }
        nextSeed = parsed;
      }
    }

    if (
      !window.confirm(
        choice === "replay"
          ? "This restarts on the same map and discards your current progress. Continue?"
          : "Starting a new game permanently discards your current save. Continue?",
      )
    ) {
      return;
    }

    if (choice === "replay") {
      onReplayCurrent();
      return;
    }
    if (choice === "newPlayer") {
      onNewPlayer();
      return;
    }
    onStartNewSeed(nextSeed!);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <input type="radio" name="new-game-choice" checked={choice === "replay"} onChange={() => setChoice("replay")} />
        <span>
          Replay the current map
          <br />
          <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>Seed: {currentSeed}</span>
        </span>
      </label>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <input type="radio" name="new-game-choice" checked={choice === "newSeed"} onChange={() => setChoice("newSeed")} />
        <span>Start a new game</span>
      </label>
      {choice === "newSeed" && (
        <div style={{ marginLeft: "1.75rem" }}>
          <label htmlFor="new-game-seed">Seed</label>
          <input
            id="new-game-seed"
            type="text"
            inputMode="numeric"
            value={seedInput}
            onChange={(event) => {
              setSeedInput(event.target.value);
              setSeedError(null);
            }}
            style={{ display: "block", marginTop: "0.25rem", width: "100%", boxSizing: "border-box" }}
          />
          <p style={{ margin: "0.35rem 0 0", opacity: 0.7, fontSize: "0.85rem" }}>
            Share this seed with someone else to both explore the identical map.
          </p>
          {seedError && (
            <p role="alert" style={{ margin: "0.35rem 0 0" }}>
              {seedError}
            </p>
          )}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <input
          type="radio"
          name="new-game-choice"
          checked={choice === "newPlayer"}
          onChange={() => setChoice("newPlayer")}
        />
        <span>Start as a new player</span>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
        <SheetButton onClick={handleConfirm}>{confirmLabel}</SheetButton>
        {onCancel && (
          <SheetButton variant="secondary" onClick={onCancel}>
            Cancel
          </SheetButton>
        )}
      </div>
    </div>
  );
}
