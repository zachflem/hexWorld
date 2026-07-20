import { useState } from "react";
import { generateSeed } from "../data/world";

export type NewGameChoice = "replay" | "newSeed" | "newPlayer";

/**
 * Replaces the old placeholder menu's three separate window.confirm/prompt
 * entry points (Restart Current Game / Start a New Game / New Player) with
 * one dialog offering all three choices — used both from GameScreen's menu
 * and from GameOverScreen. Only invokes the callback props; App.tsx's
 * resetGame remains the single source of truth for actually wiping/rebuilding
 * persisted state.
 */
export function NewGameDialog({
  currentSeed,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onCancel,
}: {
  currentSeed: number;
  onReplayCurrent: () => void;
  onStartNewSeed: (seed: number) => void;
  onNewPlayer: () => void;
  /** Omit on GameOverScreen — there's no game left to cancel back to. */
  onCancel?: () => void;
}) {
  const [choice, setChoice] = useState<NewGameChoice>("replay");
  const [seedInput, setSeedInput] = useState(() => String(generateSeed()));
  const [seedError, setSeedError] = useState<string | null>(null);

  function handleConfirm() {
    if (choice === "replay") {
      onReplayCurrent();
      return;
    }
    if (choice === "newPlayer") {
      onNewPlayer();
      return;
    }
    const trimmed = seedInput.trim();
    if (trimmed === "") {
      onStartNewSeed(generateSeed());
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setSeedError("Seed must be a whole number");
      return;
    }
    onStartNewSeed(parsed);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #444",
          borderRadius: 8,
          padding: "1.5rem",
          minWidth: 320,
          maxWidth: 420,
          color: "white",
        }}
      >
        <h2 style={{ marginTop: 0 }}>New Game</h2>
        <p style={{ opacity: 0.8, fontSize: "0.9rem" }}>
          Starting a new game permanently discards your current save (unless you choose to replay this same map).
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.75rem 0" }}>
          <input
            type="radio"
            name="new-game-choice"
            checked={choice === "replay"}
            onChange={() => setChoice("replay")}
          />
          <span>
            Replay the current map
            <br />
            <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>Seed: {currentSeed}</span>
          </span>
        </label>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.75rem 0" }}>
          <input
            type="radio"
            name="new-game-choice"
            checked={choice === "newSeed"}
            onChange={() => setChoice("newSeed")}
          />
          <span>Start a new game</span>
        </label>
        {choice === "newSeed" && (
          <div style={{ marginLeft: "1.75rem", marginBottom: "0.75rem" }}>
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
              style={{ display: "block", marginTop: "0.25rem" }}
            />
            <p style={{ opacity: 0.7, fontSize: "0.85rem" }}>
              Share this seed with someone else to both explore the identical map.
            </p>
            {seedError && <p role="alert">{seedError}</p>}
          </div>
        )}

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", margin: "0.75rem 0" }}>
          <input
            type="radio"
            name="new-game-choice"
            checked={choice === "newPlayer"}
            onChange={() => setChoice("newPlayer")}
          />
          <span>Start as a new player</span>
        </label>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
