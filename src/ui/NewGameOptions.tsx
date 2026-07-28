import { useState } from "react";
import type { CSSProperties } from "react";
import { generateSeed } from "../data/world";
import { useConfirm } from "./primitives/ConfirmProvider";
import { SheetButton } from "./primitives/SheetButton";
import { SheetSectionLabel } from "./primitives/SheetListItem";

export type NewGameChoice = "replay" | "newSeed" | "newPlayer";

/**
 * Shared new-game choice form — Settings embeds it inline; NewGameDialog wraps
 * it in a BottomSheet for win/lose screens. App.tsx reset handlers stay the
 * source of truth for wiping/rebuilding persisted state.
 *
 * Choice rows match TileActionSheet ActionRow chrome (0.9rem title / 0.78rem
 * detail) so Settings and win/lose don't inherit the larger root font size.
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
  const confirm = useConfirm();
  const [choice, setChoice] = useState<NewGameChoice>("replay");
  /** Blank = random on confirm — do not pre-fill a mount-time seed (#68). */
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);

  async function handleConfirm() {
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

    const ok = await confirm({
      title: "Discard progress?",
      message:
        choice === "replay"
          ? "This restarts on the same map and discards your current progress."
          : "Starting a new game permanently discards your current save.",
      confirmLabel: "Continue",
    });
    if (!ok) return;

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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      <div
        role="radiogroup"
        aria-label="New game options"
        style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
      >
        <ChoiceRow
          selected={choice === "replay"}
          title="Replay the current map"
          detail={`Seed: ${currentSeed}`}
          onSelect={() => setChoice("replay")}
        />
        <ChoiceRow
          selected={choice === "newSeed"}
          title="Start a new game"
          onSelect={() => setChoice("newSeed")}
        />
        {choice === "newSeed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0 0.15rem" }}>
            <SheetSectionLabel>
              <label htmlFor="new-game-seed">Seed</label>
            </SheetSectionLabel>
            <input
              id="new-game-seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              placeholder="Random (or enter a custom seed)"
              onChange={(event) => {
                setSeedInput(event.target.value);
                setSeedError(null);
              }}
              style={SEED_INPUT_STYLE}
            />
            <p style={{ margin: 0, opacity: 0.75, fontSize: "0.78rem", lineHeight: 1.35, textAlign: "left" }}>
              Leave blank for a fresh random map, or enter a seed to share/replay an identical one.
            </p>
            {seedError && (
              <p role="alert" style={{ margin: 0, fontSize: "0.78rem", color: "#ff8080", textAlign: "left" }}>
                {seedError}
              </p>
            )}
          </div>
        )}
        <ChoiceRow
          selected={choice === "newPlayer"}
          title="Start as a new player"
          onSelect={() => setChoice("newPlayer")}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.1rem" }}>
        <SheetButton onClick={() => void handleConfirm()}>{confirmLabel}</SheetButton>
        {onCancel && (
          <SheetButton variant="secondary" onClick={onCancel}>
            Cancel
          </SheetButton>
        )}
      </div>
    </div>
  );
}

/** Mirrors TileActionSheet ActionRow title/detail + shell. */
function ChoiceRow({
  selected,
  title,
  detail,
  onSelect,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        width: "100%",
        textAlign: "left",
        background: selected ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.04)",
        border: selected ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
        color: "white",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{title}</span>
        {detail && <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>{detail}</span>}
      </span>
    </button>
  );
}

const SEED_INPUT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "0.55rem 0.65rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  lineHeight: 1.3,
  background: "rgba(0, 0, 0, 0.35)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 8,
  color: "white",
  fontFamily: "inherit",
};
