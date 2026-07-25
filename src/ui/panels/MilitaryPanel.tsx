import type { UnitsRecord } from "../../data/units";
import type { GarrisonsRecord } from "../../data/garrisons";
import type { Barracks } from "../../data/barracks";
import type { Tweaks } from "../../data/tweaksSchema";
import {
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
} from "../../engine/barracks";
import { garrisonedCrossBowSniperTotal, garrisonedJunkyardKnightTotal, garrisonedMilitiaTotal } from "../../engine/garrisons";
import { BottomSheet } from "../primitives/BottomSheet";
import { StatRow } from "../primitives/StatRow";

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
  const militiaCap = militiaCapacity(tweaks, barracksList);
  const knightCap = junkyardKnightCapacity(tweaks, barracksList);
  const sniperCap = crossBowSniperCapacity(tweaks, barracksList);
  const garrisonedMilitia = garrisonedMilitiaTotal(garrisons);
  const garrisonedKnights = garrisonedJunkyardKnightTotal(garrisons);
  const garrisonedSnipers = garrisonedCrossBowSniperTotal(garrisons);

  return (
    <BottomSheet open title="Military" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <StatRow
          label="Militia"
          current={units.militiaCount}
          max={militiaCap}
          displayValue={
            garrisonedMilitia > 0 ? `${units.militiaCount}/${militiaCap} (${garrisonedMilitia} garrisoned)` : undefined
          }
        />
        <StatRow
          label="Junkyard Knights"
          current={units.junkyardKnightCount}
          max={knightCap}
          displayValue={
            garrisonedKnights > 0
              ? `${units.junkyardKnightCount}/${knightCap} (${garrisonedKnights} garrisoned)`
              : undefined
          }
        />
        <StatRow
          label="Cross-Bow Snipers"
          current={units.crossBowSniperCount}
          max={sniperCap}
          displayValue={
            garrisonedSnipers > 0
              ? `${units.crossBowSniperCount}/${sniperCap} (${garrisonedSnipers} garrisoned)`
              : undefined
          }
        />
      </div>
    </BottomSheet>
  );
}
