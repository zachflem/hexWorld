import type { Player } from "../../data/player";
import { Panel } from "../primitives/Panel";

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
    <Panel style={{ position: "fixed", right: "1rem", bottom: "4.5rem", width: 280, fontSize: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "1rem" }}>Settings</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <strong style={{ color: player.color }}>{player.name}</strong>
        <p style={{ margin: 0, opacity: 0.8 }}>Seed: {seed}</p>
        <button type="button" onClick={onRecenterOnBase}>
          Recenter on Base
        </button>
        <button type="button" onClick={onNewGame}>
          New Game
        </button>
      </div>
    </Panel>
  );
}
