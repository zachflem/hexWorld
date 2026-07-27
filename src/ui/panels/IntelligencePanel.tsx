import type { Axial } from "../../engine/hexCoords";
import type { LabRecord } from "../../data/lab";
import type { Tweaks } from "../../data/tweaksSchema";
import { labClueText } from "../../engine/lab";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetInfoCard, SheetListItem, SheetSectionLabel } from "../primitives/SheetListItem";

/** Lab clues and intel returns — formerly ScoutingPanel (unit logistics moved to Personnel). */
export function IntelligencePanel({
  tweaks,
  lab,
  base,
  onClose,
}: {
  tweaks: Tweaks;
  lab: LabRecord;
  base: Axial;
  onClose: () => void;
}) {
  const clueHistory = Array.from({ length: lab.cluesCollected }, (_, i) => i + 1).map((n) => ({
    n,
    text: labClueText(n, base, lab.coord),
  }));

  return (
    <BottomSheet open title="Intelligence" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {lab.watchtowerSignal ? (
          <SheetInfoCard>
            <span>Watchtower signal: {lab.watchtowerSignal.bearing}</span>
          </SheetInfoCard>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>
            Lab clues ({lab.cluesCollected}/{tweaks.lab_clues.total_clues})
          </SheetSectionLabel>
          {lab.secured ? (
            <SheetListItem title="Lab secured" detail="You win." />
          ) : clueHistory.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>
              No clues yet — clear dens to gather directional lab clues. Watchtower signals guide scouts
              separately.
            </p>
          ) : (
            clueHistory.map(({ n, text }) => (
              <SheetListItem key={n} title={`Clue ${n}`} detail={text ?? undefined} />
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
