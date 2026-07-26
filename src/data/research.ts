/**
 * A first research/tech tree — two independent lines, each with two
 * purchasable tiers on top of the free default (tier 1). Sequential within a
 * line (tier 3 requires tier 2 already completed), but the two lines don't
 * gate each other. Modeled on data/storageUpgrades.ts's pending-upgrade
 * shape, simplified to a single global slot since only one research can run
 * at a time (unlike storage, where every resource can upgrade in parallel).
 */
export type ResearchId =
  | "troop_speed_2"
  | "troop_speed_3"
  | "game_speed_2"
  | "game_speed_3"
  | "parallel_upgrades"
  | "improved_optics";

/** Every purchasable research id — used for affordability / startable scans. */
export const ALL_RESEARCH_IDS: readonly ResearchId[] = [
  "troop_speed_2",
  "troop_speed_3",
  "game_speed_2",
  "game_speed_3",
  "parallel_upgrades",
  "improved_optics",
];

export type ResearchRecord = {
  completed: ResearchId[];
  pending: { id: ResearchId; startedAt: number } | null;
};

export const RESEARCH_DB_KEY = "research";

export function initialResearch(): ResearchRecord {
  return { completed: [], pending: null };
}
