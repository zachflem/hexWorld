import type { ResearchId, ResearchRecord } from "../data/research";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { isResearchAvailable, isResearchBusy, researchCost, researchDurationMs } from "../engine/research";
import { remainingMs } from "../engine/timers";
import { UPGRADE_AVAILABLE_BADGE_COLOR } from "../render/HexCanvas";
import type { BuildResult } from "../App";
import { formatCost } from "./format";
import { RESEARCH_LABEL } from "./researchLabels";
import { BottomSheet } from "./primitives/BottomSheet";
import { InProgressRow } from "./primitives/InProgressRow";
import { SheetListItem, SheetSectionLabel } from "./primitives/SheetListItem";

function ResearchTierRow({
  id,
  tweaks,
  research,
  resources,
  now,
  onStartResearch,
}: {
  id: ResearchId;
  tweaks: Tweaks;
  research: ResearchRecord;
  resources: ResourceAmounts;
  now: number;
  onStartResearch: (id: ResearchId) => Promise<BuildResult>;
}) {
  const completed = research.completed.includes(id);
  const cost = researchCost(tweaks, id);
  const durationLabel = `${researchDurationMs(tweaks, id) / 60_000}m`;

  if (completed) {
    return <SheetListItem title={RESEARCH_LABEL[id]} detail="Researched" muted />;
  }

  if (research.pending?.id === id) {
    const remaining = remainingMs(research.pending.startedAt, researchDurationMs(tweaks, id), now);
    return (
      <SheetListItem title={RESEARCH_LABEL[id]}>
        <InProgressRow label="Researching" remainingMs={remaining} />
      </SheetListItem>
    );
  }

  const available = isResearchAvailable(research, id);
  if (!available) {
    return <SheetListItem title={RESEARCH_LABEL[id]} detail="Requires the previous tier first" muted />;
  }

  const canAfford = Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));
  const blockedByOtherResearch = isResearchBusy(research);
  const disabled = !canAfford || blockedByOtherResearch;
  const ready = !disabled;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onStartResearch(id)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "left",
        background: ready ? "rgba(224, 142, 11, 0.12)" : "rgba(255, 255, 255, 0.04)",
        border: ready ? `1px solid ${UPGRADE_AVAILABLE_BADGE_COLOR}` : "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
        color: "white",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{RESEARCH_LABEL[id]}</span>
      <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>
        {blockedByOtherResearch
          ? "Another research in progress"
          : !canAfford
            ? `${formatCost(cost)} · ${durationLabel} · can't afford`
            : `Research · ${formatCost(cost)} · ${durationLabel}`}
      </span>
    </button>
  );
}

export function ResearchPanel({
  tweaks,
  research,
  resources,
  now,
  onStartResearch,
  onClose,
}: {
  tweaks: Tweaks;
  research: ResearchRecord;
  resources: ResourceAmounts;
  now: number;
  onStartResearch: (id: ResearchId) => Promise<BuildResult>;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open
      title="Research"
      onClose={onClose}
      // Taller than the default tile-action sheet so the full tree is usable without feeling cramped.
      style={{ height: "min(70vh, 560px)" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>Troop Movement Speed</SheetSectionLabel>
          <ResearchTierRow id="troop_speed_2" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
          <ResearchTierRow id="troop_speed_3" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>Game Speed</SheetSectionLabel>
          <ResearchTierRow id="game_speed_2" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
          <ResearchTierRow id="game_speed_3" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <SheetSectionLabel>Construction</SheetSectionLabel>
          <ResearchTierRow id="parallel_upgrades" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
        </div>
      </div>
    </BottomSheet>
  );
}
