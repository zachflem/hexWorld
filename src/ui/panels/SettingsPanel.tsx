import type { Player } from "../../data/player";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetButton } from "../primitives/SheetButton";
import { SheetInfoCard } from "../primitives/SheetListItem";

/**
 * Absorbs everything that used to live in the `☰` dropdown (now removed in
 * favor of the global hex cluster): player identity, seed display, "New
 * Game", and "Recenter on Base" — none of these fit the other five panel
 * slots (garrisons/scouting/military/build-mode/research), so this is the
 * catch-all for infrequent, non-gameplay actions. Starts minimal; a real
 * help/notification-preferences section can grow here later.
 */
export function SettingsPanel({
  player,
  seed,
  onRecenterOnBase,
  onNewGame,
  onClose,
}: {
  player: Player;
  seed: number;
  onRecenterOnBase: () => void;
  onNewGame: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open title="Settings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <SheetInfoCard>
          <strong style={{ color: player.color, fontSize: "0.95rem" }}>{player.name}</strong>
          <span style={{ opacity: 0.75 }}>Seed: {seed}</span>
        </SheetInfoCard>
        <SheetButton variant="secondary" onClick={onRecenterOnBase}>
          Recenter on Base
        </SheetButton>
        <SheetButton variant="secondary" onClick={onNewGame}>
          New Game
        </SheetButton>
      </div>
    </BottomSheet>
  );
}
