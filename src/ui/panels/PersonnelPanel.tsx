import type { UnitsRecord } from "../../data/units";
import type { GarrisonsRecord } from "../../data/garrisons";
import type { Barracks } from "../../data/barracks";
import type { ScoutSkiffsRecord } from "../../data/scoutSkiffs";
import type { WanderingScoutsRecord } from "../../data/wanderingScouts";
import type { Tweaks } from "../../data/tweaksSchema";
import {
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
} from "../../engine/barracks";
import {
  garrisonedCrossBowSniperTotal,
  garrisonedJunkyardKnightTotal,
  garrisonedMilitiaTotal,
} from "../../engine/garrisons";
import { totalUpkeepPerSecond, type UnitCommitments } from "../../engine/units";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetInfoCard, SheetSectionLabel } from "../primitives/SheetListItem";
import { StatRow } from "../primitives/StatRow";

/** Owned units + outgoing food upkeep — formerly MilitaryPanel. */
export function PersonnelPanel({
  tweaks,
  units,
  garrisons,
  barracksList,
  scoutSkiffs,
  wanderingScouts,
  commitments,
  onClose,
}: {
  tweaks: Tweaks;
  units: UnitsRecord;
  garrisons: GarrisonsRecord;
  barracksList: Barracks[];
  scoutSkiffs: ScoutSkiffsRecord;
  wanderingScouts: WanderingScoutsRecord;
  commitments?: UnitCommitments;
  onClose: () => void;
}) {
  const militiaCap = militiaCapacity(tweaks, barracksList);
  const knightCap = junkyardKnightCapacity(tweaks, barracksList);
  const sniperCap = crossBowSniperCapacity(tweaks, barracksList);
  const garrisonedMilitia = garrisonedMilitiaTotal(garrisons);
  const garrisonedKnights = garrisonedJunkyardKnightTotal(garrisons);
  const garrisonedSnipers = garrisonedCrossBowSniperTotal(garrisons);
  const foodUpkeepPerSec = totalUpkeepPerSecond(tweaks, units, commitments);
  const upkeepDisplay =
    foodUpkeepPerSec === 0
      ? "0/sec"
      : `−${foodUpkeepPerSec < 0.1 ? foodUpkeepPerSec.toFixed(3) : foodUpkeepPerSec.toFixed(2)}/sec`;

  return (
    <BottomSheet open title="Personnel" onClose={onClose}>
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

        <SheetInfoCard>
          <span>Scout skiffs: {scoutSkiffs.length}</span>
          <span>Wandering scouts: {wanderingScouts.length}</span>
        </SheetInfoCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <SheetSectionLabel>Outgoing requirements</SheetSectionLabel>
          <SheetInfoCard>
            <span>Food upkeep: {upkeepDisplay}</span>
            <span style={{ opacity: 0.7, fontSize: "0.78rem" }}>
              Barracks-idle combat units only — same rate as the top resource bar.
            </span>
          </SheetInfoCard>
        </div>
      </div>
    </BottomSheet>
  );
}
