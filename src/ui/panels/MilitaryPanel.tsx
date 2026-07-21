import type { UnitsRecord } from "../../data/units";
import type { GarrisonsRecord } from "../../data/garrisons";
import type { Barracks } from "../../data/barracks";
import type { Tweaks } from "../../data/tweaksSchema";
import {
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
  scoutCapacity,
} from "../../engine/barracks";
import { garrisonedCrossBowSniperTotal, garrisonedJunkyardKnightTotal, garrisonedMilitiaTotal } from "../../engine/garrisons";
import { Panel } from "../primitives/Panel";

function UnitRow({ label, count, capacity, garrisoned }: { label: string; count: number; capacity: number; garrisoned?: number }) {
  return (
    <div style={{ padding: "0.25rem 0" }}>
      {label}: {count}/{capacity}
      {garrisoned !== undefined && garrisoned > 0 && ` (${garrisoned} garrisoned)`}
    </div>
  );
}

/** Standing-army totals + capacities across the whole territory, at a glance — previously only visible one barracks at a time via the tile popup. */
export function MilitaryPanel({
  tweaks,
  units,
  garrisons,
  barracksList,
  onClose,
}: {
  tweaks: Tweaks;
  units: UnitsRecord;
  garrisons: GarrisonsRecord;
  barracksList: Barracks[];
  onClose: () => void;
}) {
  return (
    <Panel style={{ position: "fixed", right: "1rem", bottom: "4.5rem", width: 300, fontSize: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "1rem" }}>Military</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <UnitRow label="Scouts" count={units.scoutStockpile} capacity={scoutCapacity(tweaks, barracksList)} />
        <UnitRow
          label="Militia"
          count={units.militiaCount}
          capacity={militiaCapacity(tweaks, barracksList)}
          garrisoned={garrisonedMilitiaTotal(garrisons)}
        />
        <UnitRow
          label="Junkyard Knights"
          count={units.junkyardKnightCount}
          capacity={junkyardKnightCapacity(tweaks, barracksList)}
          garrisoned={garrisonedJunkyardKnightTotal(garrisons)}
        />
        <UnitRow
          label="Cross-Bow Snipers"
          count={units.crossBowSniperCount}
          capacity={crossBowSniperCapacity(tweaks, barracksList)}
          garrisoned={garrisonedCrossBowSniperTotal(garrisons)}
        />
      </div>
    </Panel>
  );
}
