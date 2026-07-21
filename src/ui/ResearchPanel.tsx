import type { ResearchId, ResearchRecord } from "../data/research";
import type { ResourceAmounts } from "../data/resources";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { isResearchAvailable, researchCost, researchDurationMs } from "../engine/research";
import { remainingMs } from "../engine/timers";
import type { BuildResult } from "../App";
import { formatDuration } from "./TilePopup";
import { Panel } from "./primitives/Panel";

function formatCost(cost: Partial<Record<ResourceType, number>>): string {
  return Object.entries(cost)
    .map(([res, amount]) => `${Math.ceil(amount ?? 0)} ${res}`)
    .join(" + ");
}

function affordable(resources: ResourceAmounts, cost: Partial<Record<ResourceType, number>>): boolean {
  return Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));
}

const RESEARCH_LABEL: Record<ResearchId, string> = {
  troop_speed_2: "Troop Movement II (1.5x)",
  troop_speed_3: "Troop Movement III (2.0x)",
  game_speed_2: "Game Speed II (unlocks 3x)",
  game_speed_3: "Game Speed III (unlocks 5x)",
};

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

  if (completed) {
    return (
      <div style={{ padding: "0.4rem 0", opacity: 0.7 }}>
        <strong>{RESEARCH_LABEL[id]}</strong> — researched
      </div>
    );
  }

  if (research.pending?.id === id) {
    const remaining = remainingMs(research.pending.startedAt, researchDurationMs(tweaks, id), now);
    return (
      <div style={{ padding: "0.4rem 0" }}>
        <strong>{RESEARCH_LABEL[id]}</strong> — researching, {formatDuration(remaining)} remaining
      </div>
    );
  }

  const available = isResearchAvailable(research, id);
  const canAfford = affordable(resources, cost);
  const blockedByOtherResearch = research.pending !== null;

  return (
    <div style={{ padding: "0.4rem 0", opacity: available ? 1 : 0.5 }}>
      <div>
        <strong>{RESEARCH_LABEL[id]}</strong> — {formatCost(cost)}, {researchDurationMs(tweaks, id) / 60_000}m
      </div>
      {!available ? (
        <span style={{ fontSize: "0.8rem" }}>Requires the previous tier first</span>
      ) : (
        <button type="button" disabled={!canAfford || blockedByOtherResearch} onClick={() => onStartResearch(id)}>
          Research
        </button>
      )}
    </div>
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
    <Panel style={{ position: "fixed", right: "1rem", bottom: "4.5rem", width: 320, fontSize: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "1rem" }}>Research</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <div style={{ opacity: 0.8, marginBottom: "0.25rem" }}>Troop Movement Speed</div>
        <ResearchTierRow id="troop_speed_2" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
        <ResearchTierRow id="troop_speed_3" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <div style={{ opacity: 0.8, marginBottom: "0.25rem" }}>Game Speed</div>
        <ResearchTierRow id="game_speed_2" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
        <ResearchTierRow id="game_speed_3" tweaks={tweaks} research={research} resources={resources} now={now} onStartResearch={onStartResearch} />
      </div>
    </Panel>
  );
}
