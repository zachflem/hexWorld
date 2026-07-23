import type { GarrisonsRecord } from "../../data/garrisons";
import type { GarrisonRecallsRecord } from "../../data/garrisonRecalls";
import { remainingMs } from "../../engine/timers";
import { formatDuration } from "../format";
import { BottomSheet } from "../primitives/BottomSheet";
import { SheetListItem, SheetSectionLabel } from "../primitives/SheetListItem";

function garrisonDetail(garrison: GarrisonsRecord[number]): string {
  const parts = [`${garrison.militiaCount} militia`];
  if (garrison.junkyardKnightCount > 0) parts.push(`${garrison.junkyardKnightCount} knights`);
  if (garrison.crossBowSniperCount > 0) parts.push(`${garrison.crossBowSniperCount} snipers`);
  return parts.join(", ");
}

/** Every garrisoned tile at a glance, plus any recalls currently marching home — previously only visible by clicking each tile individually. */
export function GarrisonsPanel({
  garrisons,
  garrisonRecalls,
  now,
  onClose,
}: {
  garrisons: GarrisonsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  now: number;
  onClose: () => void;
}) {
  return (
    <BottomSheet open title="Garrisons" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {garrisons.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>No garrisons stationed.</p>
        ) : (
          garrisons.map((garrison) => (
            <SheetListItem
              key={`${garrison.coord.q},${garrison.coord.r}`}
              title={`(${garrison.coord.q}, ${garrison.coord.r})`}
              detail={garrisonDetail(garrison)}
            />
          ))
        )}
      </div>

      {garrisonRecalls.length > 0 && (
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>Recalling</SheetSectionLabel>
          {garrisonRecalls.map((recall) => (
            <SheetListItem
              key={recall.id}
              title={`(${recall.coord.q}, ${recall.coord.r})`}
              detail={formatDuration(remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now))}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
