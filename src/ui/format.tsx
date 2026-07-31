import type { ReactNode } from "react";
import type { ResourceAmounts, ResourceType } from "../data/resources";

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

/** Same red as action-error toasts — marks resource lines the player cannot pay. */
const LACKING_RESOURCE_COLOR = "#ff8080";

/**
 * Cost line for bottom-sheet action rows. Each resource the player cannot
 * afford is colored red; no shortfall delta is shown.
 */
export function CostDetail({
  cost,
  resources,
  prefix,
  suffix,
}: {
  cost: Partial<Record<ResourceType, number>>;
  resources: ResourceAmounts;
  prefix?: string;
  suffix?: string;
}): ReactNode {
  const entries = Object.entries(cost);
  return (
    <>
      {prefix}
      {entries.map(([res, amount], i) => {
        const need = Math.ceil(amount ?? 0);
        const lacking = resources[res as ResourceType] < (amount ?? 0);
        return (
          <span key={res}>
            {i > 0 ? " + " : null}
            <span style={lacking ? { color: LACKING_RESOURCE_COLOR } : undefined}>
              {need} {res}
            </span>
          </span>
        );
      })}
      {suffix != null && suffix !== "" ? `, ${suffix}` : null}
    </>
  );
}
