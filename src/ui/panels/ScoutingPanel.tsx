import type { Axial } from "../../engine/hexCoords";
import type { Barracks } from "../../data/barracks";
import type { UnitsRecord } from "../../data/units";
import type { ScoutSkiffsRecord } from "../../data/scoutSkiffs";
import type { WanderingScoutsRecord } from "../../data/wanderingScouts";
import type { LabRecord } from "../../data/lab";
import type { Tweaks } from "../../data/tweaksSchema";
import { scoutCapacity } from "../../engine/barracks";
import { labClueText } from "../../engine/lab";
import { Panel } from "../primitives/Panel";

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
    <Panel style={{ position: "fixed", right: "1rem", bottom: "4.5rem", width: 320, fontSize: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "1rem" }}>Scouting</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <div>
          Scouts: {units.scoutStockpile}/{scoutCapacity(tweaks, barracksList)}
        </div>
        <div>Scout skiffs: {scoutSkiffs.length}</div>
        <div>Wandering scouts: {wanderingScouts.length}</div>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <div style={{ opacity: 0.8, marginBottom: "0.25rem" }}>
          Lab clues ({lab.cluesCollected}/{tweaks.lab_clues.total_clues})
        </div>
        {lab.secured ? (
          <p>Lab secured — you win.</p>
        ) : clueHistory.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No clues collected yet.</p>
        ) : (
          clueHistory.map(({ n, text }) => (
            <div key={n} style={{ padding: "0.15rem 0" }}>
              {n}. {text}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
