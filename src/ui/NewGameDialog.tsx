import { NewGameOptions } from "./NewGameOptions";

/**
 * Modal wrapper around NewGameOptions for win/lose screens. Settings embeds
 * the same options inline — App.tsx reset handlers remain the single source
 * of truth for wiping/rebuilding persisted state.
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
        <NewGameOptions
          currentSeed={currentSeed}
          onReplayCurrent={onReplayCurrent}
          onStartNewSeed={onStartNewSeed}
          onNewPlayer={onNewPlayer}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
