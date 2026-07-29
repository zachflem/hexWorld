import { ALL_RESEARCH_IDS, type ResearchId, type ResearchRecord } from "../data/research";
import type { ResourceAmounts, ResourceType } from "../data/resources";
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
    case "parallel_upgrades":
      return tweaks.research.parallel_upgrades;
    case "improved_optics":
      return tweaks.research.improved_optics;
    case "scout_to_own":
      return tweaks.research.scout_to_own;
  }
}

export function researchCost(tweaks: Tweaks, id: ResearchId): Partial<Record<ResourceType, number>> {
  return tierConfig(tweaks, id).cost as Partial<Record<ResourceType, number>>;
}

export function researchDurationMs(tweaks: Tweaks, id: ResearchId): number {
  return tierConfig(tweaks, id).duration_minutes * 60_000;
}

/** Timed-task slots per structure (and base hub) — 1 by default, raised by parallel_upgrades research. */
export function structureTaskSlotCap(research: ResearchRecord): number {
  return research.completed.includes("parallel_upgrades") ? 2 : 1;
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

/** Axial spiral radius revealed per wandering-scout step once Improved Optics is done; 0 otherwise. */
export function wanderingScoutRevealRadius(tweaks: Tweaks, research: ResearchRecord): number {
  return research.completed.includes("improved_optics")
    ? tweaks.research.improved_optics.wandering_scout_reveal_radius
    : 0;
}

/** True when Scout to Own is researched — scouts/skiffs claim tiles they traverse. */
export function scoutToOwnEnabled(research: ResearchRecord): boolean {
  return research.completed.includes("scout_to_own");
}

/** Axial spiral own-range around each territory-expedition path tile once Improved Optics is done; 0 otherwise. */
export function expeditionOwnRange(tweaks: Tweaks, research: ResearchRecord): number {
  return research.completed.includes("improved_optics")
    ? tweaks.research.improved_optics.expedition_own_range
    : 0;
}

function canAffordResearch(tweaks: Tweaks, id: ResearchId, resources: ResourceAmounts): boolean {
  const cost = researchCost(tweaks, id);
  return Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));
}

/** True when at least one research row is startable — available, affordable, and the global slot is free. */
export function hasStartableResearch(
  tweaks: Tweaks,
  research: ResearchRecord,
  resources: ResourceAmounts,
): boolean {
  if (isResearchBusy(research)) return false;
  return ALL_RESEARCH_IDS.some(
    (id) => isResearchAvailable(research, id) && canAffordResearch(tweaks, id, resources),
  );
}
