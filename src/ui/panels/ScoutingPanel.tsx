import type { Axial } from "../../engine/hexCoords";
import type { Barracks } from "../../data/barracks";
import type { UnitsRecord } from "../../data/units";
import type { ScoutSkiffsRecord } from "../../data/scoutSkiffs";
import type { WanderingScoutsRecord } from "../../data/wanderingScouts";
import type { LabRecord } from "../../data/lab";
import type { Tweaks } from "../../data/tweaksSchema";
import { scoutCapacity } from "../../engine/barracks";
import { labClueText } from "../../engine/lab";
import { BottomSheet } from "../primitives/BottomSheet";
import { StatRow } from "../primitives/StatRow";
import { SheetInfoCard, SheetListItem, SheetSectionLabel } from "../primitives/SheetListItem";

/** Scouting/exploration status + the lab's clue history — previously the clue count/latest hint lived in the HUD header with no history, and skiffs/wandering scouts had no summary view at all. */
export function ScoutingPanel({
  tweaks,
  units,
  barracksList,
  scoutSkiffs,
  wanderingScouts,
  lab,
  base,
  onClose,
}: {
  tweaks: Tweaks;
  units: UnitsRecord;
  barracksList: Barracks[];
  scoutSkiffs: ScoutSkiffsRecord;
  wanderingScouts: WanderingScoutsRecord;
  lab: LabRecord;
  base: Axial;
  onClose: () => void;
}) {
  const clueHistory = Array.from({ length: lab.cluesCollected }, (_, i) => i + 1).map((n) => ({
    n,
    text: labClueText(n, base, lab.coord),
  }));

  return (
    <BottomSheet open title="Scouting" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <StatRow label="Scouts" current={units.scoutStockpile} max={scoutCapacity(tweaks, barracksList)} />
        <SheetInfoCard>
          <span>Scout skiffs: {scoutSkiffs.length}</span>
          <span>Wandering scouts: {wanderingScouts.length}</span>
          {lab.watchtowerSignal ? (
            <span>Watchtower signal: {lab.watchtowerSignal.bearing}</span>
          ) : null}
        </SheetInfoCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>
            Lab clues ({lab.cluesCollected}/{tweaks.lab_clues.total_clues})
          </SheetSectionLabel>
          {lab.secured ? (
            <SheetListItem title="Lab secured" detail="You win." />
          ) : clueHistory.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>No clues collected yet.</p>
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
