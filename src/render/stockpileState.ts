/** Local stockpile fill ratio at which the collect pin turns green. */
export const STOCKPILE_WARNING_RATIO = 0.75;

export type StockpileVisualState = "normal" | "warning" | "full";

export function stockpileVisualState(stockpile: number, cap: number): StockpileVisualState {
  if (cap <= 0) return "normal";
  const ratio = stockpile / cap;
  if (ratio >= 1) return "full";
  if (ratio >= STOCKPILE_WARNING_RATIO) return "warning";
  return "normal";
}

/**
 * Whether the map collect pin should render for a local stockpile.
 * Upgrade affordability does not force the pin — level badges cover that.
 * Thresholds come from `tweaks.storage.collect_pin_*_show_ratio`.
 */
export function collectPinVisible(
  stockpile: number,
  cap: number,
  hasCourierAutomation: boolean,
  manualShowRatio: number,
  courierShowRatio: number,
): boolean {
  if (stockpile <= 0 || cap <= 0) return false;
  const threshold = hasCourierAutomation ? courierShowRatio : manualShowRatio;
  return stockpile / cap >= threshold;
}

export type CollectPinColorState = StockpileVisualState | "upgrade";

/** Stockpile urgency wins over the upgrade-available orange. */
export function collectPinColorState(
  stockpile: number,
  cap: number,
  upgradeAvailable: boolean,
): CollectPinColorState {
  const stockpileState = stockpileVisualState(stockpile, cap);
  if (stockpileState !== "normal") return stockpileState;
  if (upgradeAvailable) return "upgrade";
  return "normal";
}

export const COLLECT_PIN_COLORS: Record<CollectPinColorState, { fill: string; stroke: string }> = {
  normal: { fill: "rgba(20, 20, 22, 0.94)", stroke: "rgba(255, 255, 255, 0.28)" },
  warning: { fill: "rgba(46, 175, 80, 0.94)", stroke: "rgba(146, 213, 151, 0.6)" },
  full: { fill: "rgba(231, 76, 60, 0.94)", stroke: "rgba(255, 160, 150, 0.6)" },
  upgrade: { fill: "rgba(224, 142, 11, 0.94)", stroke: "rgba(255, 200, 120, 0.6)" },
};
