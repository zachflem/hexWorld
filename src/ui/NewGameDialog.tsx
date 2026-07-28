import { NewGameOptions } from "./NewGameOptions";
import { BottomSheet } from "./primitives/BottomSheet";

/**
 * BottomSheet wrapper around NewGameOptions for win/lose screens. Settings
 * embeds the same options inline — App.tsx reset handlers remain the single
 * source of truth for wiping/rebuilding persisted state.
 */
export function NewGameDialog({
  currentSeed,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onClose,
}: {
  currentSeed: number;
  onReplayCurrent: () => void;
  onStartNewSeed: (seed: number) => void;
  onNewPlayer: () => void;
  /** Dismisses the sheet (Close / backdrop) back to the end screen. */
  onClose: () => void;
}) {
  return (
    <BottomSheet open title="New Game" onClose={onClose}>
      <NewGameOptions
        currentSeed={currentSeed}
        onReplayCurrent={onReplayCurrent}
        onStartNewSeed={onStartNewSeed}
        onNewPlayer={onNewPlayer}
        confirmLabel="Start"
      />
    </BottomSheet>
  );
}
