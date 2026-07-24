import type { Player } from "../../data/player";
import { NewGameOptions } from "../NewGameOptions";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetButton } from "../primitives/SheetButton";
import { SheetInfoCard } from "../primitives/SheetListItem";

/**
 * Catch-all for infrequent, non-gameplay actions: player identity, seed,
 * save-file export/import, and new-game choices (inline — no second dialog).
 */
export function SettingsPanel({
  player,
  seed,
  onSaveToFile,
  onLoadFromFile,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onClose,
}: {
  player: Player;
  seed: number;
  onSaveToFile: () => void;
  onLoadFromFile: () => void;
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
          <strong style={{ fontSize: "0.95rem" }}>Save file</strong>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75, lineHeight: 1.4 }}>
            Download a JSON backup, or load one from another device. Loading replaces the save on this
            browser.
          </p>
          <SheetButton variant="secondary" onClick={onSaveToFile}>
            Save to file
          </SheetButton>
          <SheetButton variant="secondary" onClick={onLoadFromFile}>
            Load from file
          </SheetButton>
        </div>

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
