import type { ResourceType } from "../data/resources";

export function formatCost(cost: Partial<Record<ResourceType, number>>): string {
  return Object.entries(cost)
    .map(([res, amount]) => `${Math.ceil(amount ?? 0)} ${res}`)
    .join(" + ");
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
