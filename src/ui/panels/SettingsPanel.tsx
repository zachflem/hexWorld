import type { Player } from "../../data/player";
import { NewGameOptions } from "../NewGameOptions";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetInfoCard } from "../primitives/SheetListItem";

/**
 * Catch-all for infrequent, non-gameplay actions: player identity, seed, and
 * new-game choices (inline — no second dialog). Recenter lives on the map
 * camera controls now.
 */
export function SettingsPanel({
  player,
  seed,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onClose,
}: {
  player: Player;
  seed: number;
  onReplayCurrent: () => void;
  onStartNewSeed: (seed: number) => void;
  onNewPlayer: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open title="Settings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <SheetInfoCard>
          <strong style={{ color: player.color, fontSize: "0.95rem" }}>{player.name}</strong>
          <span style={{ opacity: 0.75 }}>Seed: {seed}</span>
        </SheetInfoCard>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.95rem" }}>New Game</strong>
          <NewGameOptions
            currentSeed={seed}
            onReplayCurrent={onReplayCurrent}
            onStartNewSeed={onStartNewSeed}
            onNewPlayer={onNewPlayer}
            confirmLabel="Start"
          />
        </div>
      </div>
    </BottomSheet>
  );
}
