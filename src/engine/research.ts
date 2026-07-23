import type { ResearchId, ResearchRecord } from "../data/research";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";

/** Which line a given tier belongs to, and the tier-2 prerequisite tier-3 needs, if any. */
const RESEARCH_PREREQUISITE: Partial<Record<ResearchId, ResearchId>> = {
  troop_speed_3: "troop_speed_2",
  game_speed_3: "game_speed_2",
};

/** True while a research timer is running — single global slot. */
export function isResearchBusy(research: ResearchRecord): boolean {
  return research.pending != null;
}

/** True when `id` can be started — not yet completed and any prerequisite tier is done. */
export function isResearchAvailable(research: ResearchRecord, id: ResearchId): boolean {
  if (research.completed.includes(id)) return false;
  const prerequisite = RESEARCH_PREREQUISITE[id];
  return !prerequisite || research.completed.includes(prerequisite);
}

function tierConfig(tweaks: Tweaks, id: ResearchId) {
  switch (id) {
    case "troop_speed_2":
      return tweaks.research.troop_speed.tier_2;
    case "troop_speed_3":
      return tweaks.research.troop_speed.tier_3;
    case "game_speed_2":
      return tweaks.research.game_speed.tier_2;
    case "game_speed_3":
      return tweaks.research.game_speed.tier_3;
  }
}

export function researchCost(tweaks: Tweaks, id: ResearchId): Partial<Record<ResourceType, number>> {
  return tierConfig(tweaks, id).cost as Partial<Record<ResourceType, number>>;
}

export function researchDurationMs(tweaks: Tweaks, id: ResearchId): number {
  return tierConfig(tweaks, id).duration_minutes * 60_000;
}

/** 1.0 (default) / 1.5 / 2.0 — divides expeditionTravelDurationMs (engine/expeditions.ts), so a higher multiplier means faster travel. */
export function troopSpeedMultiplier(tweaks: Tweaks, research: ResearchRecord): number {
  if (research.completed.includes("troop_speed_3")) return tweaks.research.troop_speed.tier_3.multiplier;
  if (research.completed.includes("troop_speed_2")) return tweaks.research.troop_speed.tier_2.multiplier;
  return 1;
}

/** Game-speed rates unlocked by research, always including the free 1x — dev-only 10x is layered on separately in App.tsx, unaffected by research. */
export function unlockedSpeedRates(tweaks: Tweaks, research: ResearchRecord): number[] {
  const rates = [1];
  if (research.completed.includes("game_speed_2")) rates.push(tweaks.research.game_speed.tier_2.rate);
  if (research.completed.includes("game_speed_3")) rates.push(tweaks.research.game_speed.tier_3.rate);
  return rates;
}
