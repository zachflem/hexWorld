import { useState } from "react";
import { NewGameDialog } from "./NewGameDialog";
import { SheetButton } from "./primitives/SheetButton";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** DD/MM/YYYY HH:MM:SS — fixed format, independent of browser/OS locale. */
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** DESIGN.md §13 win condition — the hidden lab has been secured. Clearing dens is never required, just one route to the army that gets you here. */
export function WinScreen({
  wonAt,
  currentSeed,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
}: {
  wonAt: number | null;
  currentSeed: number;
  onReplayCurrent: () => void;
  onStartNewSeed: (seed: number) => void;
  onNewPlayer: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#0a0a0c",
        color: "white",
        textAlign: "center",
        padding: "1rem",
      }}
    >
      <h1 style={{ margin: 0 }}>The lab is secured</h1>
      <p style={{ maxWidth: 480, opacity: 0.8 }}>
        Whatever the guardian was protecting, it's yours now
        {wonAt ? ` as of ${formatDateTime(wonAt)}` : ""}. You win.
      </p>
      <div style={{ width: "min(100%, 280px)" }}>
        <SheetButton onClick={() => setDialogOpen(true)}>Start New Game</SheetButton>
      </div>
      {dialogOpen && (
        <NewGameDialog
          currentSeed={currentSeed}
          onReplayCurrent={onReplayCurrent}
          onStartNewSeed={onStartNewSeed}
          onNewPlayer={onNewPlayer}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
