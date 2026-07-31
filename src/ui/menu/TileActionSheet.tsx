import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { UPGRADE_AVAILABLE_BADGE_COLOR } from "../../render/HexCanvas";
import { BottomSheet } from "../primitives/BottomSheet";

export interface SheetQuickAction {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface SheetAction {
  key: string;
  icon: ReactNode;
  /** Short primary label shown in the row (e.g. "Build tower"). */
  title: string;
  /** Secondary line for cost / duration / status. */
  detail?: ReactNode;
  disabled?: boolean;
  /**
   * True if this action itself is an affordable upgrade — OR (for a category)
   * if any descendant has this set. Lights the row/filter with the same orange
   * used for map upgrade badges.
   */
  upgradeAvailable?: boolean;
  /**
   * Prefer this category for auto-opening its form (after In progress /
   * arrival orders). Used when a horde threatens the tile so Garrison opens
   * immediately.
   */
  preferDefault?: boolean;
  onClick?: () => void;
  /** Category group: flattened into the combined list; filterable by this key. */
  subActions?: SheetAction[];
  /** Inline form shown when the row is chosen (garrison, train, party dispatch). */
  formContent?: ReactNode;
  /** Read-only body for the Info filter (replaces the old dialogContent popover). */
  infoContent?: ReactNode;
  /**
   * Compact commit shortcuts rendered beside the row (e.g. train +1 / +5 / Max).
   * Kept outside the main row button so they stay tappable without opening the form.
   */
  quickActions?: SheetQuickAction[];
  /**
   * Optional distance metric. Leaves sharing `allListClosestGroup` only contribute
   * their nearest member to the All list; the category/Actions filter still lists all.
   */
  distance?: number;
  /** Group id for closest-only All-list behavior (e.g. scrap-yard stash targets). */
  allListClosestGroup?: string;
}

export interface SheetFilter {
  key: string;
  label: string;
  kind: "all" | "list" | "info";
  items?: SheetAction[];
  infoContent?: ReactNode;
  upgradeAvailable?: boolean;
  preferDefault?: boolean;
}

/** Flat row with the category it came from — used for filters + priority sort. */
export interface SheetListEntry {
  action: SheetAction;
  categoryKey: string;
  /** Lower = higher in the combined list among enabled peers. */
  priority: number;
}

function anyUpgradeAvailable(actions: SheetAction[]): boolean {
  return actions.some((a) => a.upgradeAvailable || (a.subActions && anyUpgradeAvailable(a.subActions)));
}

/** Usable actions first; disabled (e.g. unaffordable) sink to the bottom. Stable among peers. */
function usableFirst(actions: SheetAction[]): SheetAction[] {
  return [...actions].sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled));
}

/**
 * Leaf upgrades that used to land in the catch-all Actions group — structure
 * level/tier/reinforcement upgrades. Detected by key/title so unaffordable
 * options still group under Upgrades (not only when `upgradeAvailable`).
 */
function isUpgradeLeaf(action: SheetAction): boolean {
  const key = action.key.toLowerCase();
  if (key.includes("upgrade") || key.includes("reinforce")) return true;
  return action.title.toLowerCase().startsWith("upgrade");
}

function isUpgradeCategoryKey(key: string): boolean {
  return key === "upgrades" || key === "storage-upgrade" || key.includes("upgrade");
}

function isGarrisonKey(key: string): boolean {
  return key === "garrison" || key === "garrison-manage";
}

/** Urgent tile work that should sit above the normal priority bands. */
function isUrgentCategoryKey(key: string): boolean {
  return key === "in-progress" || key === "arrival-orders";
}

/**
 * Tile-specific tasks (train, collect, assault, repair, …) — default band 1.
 * Leaves under the catch-all Actions group are classified by their own key.
 */
function isTileTaskKey(key: string): boolean {
  if (key === "train") return true;
  if (key.startsWith("collect")) return true;
  if (key === "assault-den" || key === "secure-lab" || key === "send-scrapper") return true;
  if (key === "scout-skiff") return true;
  if (key.startsWith("scrapper-assign") || key === "scrapper-recall") return true;
  if (key.includes("repair")) return true;
  return false;
}

/**
 * Sort bands for the combined All list (among enabled items):
 * 0 urgent (in progress / arrival) or preferDefault Garrison
 * 1 tile-specific tasks (train, collect, …)
 * 2 upgrades
 * 3 garrison
 * 4 everything else
 */
export function listPriority(categoryKey: string, actionKey: string, preferDefault: boolean): number {
  if (preferDefault && isGarrisonKey(categoryKey)) return 0;
  if (preferDefault && isGarrisonKey(actionKey)) return 0;
  if (isUrgentCategoryKey(categoryKey)) return 0;

  if (isGarrisonKey(categoryKey) || isGarrisonKey(actionKey)) return 3;
  if (isUpgradeCategoryKey(categoryKey)) return 2;
  const leafKey = actionKey.toLowerCase();
  if (leafKey.includes("upgrade") || leafKey.includes("reinforce")) return 2;
  if (isTileTaskKey(categoryKey) || isTileTaskKey(actionKey)) return 1;
  return 4;
}

/** Stable secondary order inside the same priority band. */
function tieBreakKey(actionKey: string): number {
  if (actionKey.startsWith("collect")) return 0;
  if (actionKey.startsWith("scrapper-assign")) return 1;
  if (actionKey === "scrapper-recall") return 2;
  if (actionKey === "train" || actionKey.startsWith("train-")) return 3;
  if (actionKey.includes("repair")) return 4;
  if (actionKey === "demolish") return 90;
  return 50;
}

function sortEntries(entries: SheetListEntry[]): SheetListEntry[] {
  return [...entries].sort((a, b) => {
    const disabledDelta = Number(!!a.action.disabled) - Number(!!b.action.disabled);
    if (disabledDelta !== 0) return disabledDelta;
    if (a.priority !== b.priority) return a.priority - b.priority;
    const tie = tieBreakKey(a.action.key) - tieBreakKey(b.action.key);
    if (tie !== 0) return tie;
    const da = a.action.distance ?? Number.POSITIVE_INFINITY;
    const db = b.action.distance ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return 0;
  });
}

export interface SheetModel {
  filters: SheetFilter[];
  /** Combined All-list rows, usable-first then priority bands. */
  allEntries: SheetListEntry[];
}

/** Derive filter pills + sorted combined list from the root action tree. */
export function deriveSheetModel(actions: SheetAction[]): SheetModel {
  const categoryFilters: SheetFilter[] = [];
  const leafActions: SheetAction[] = [];
  let infoContent: ReactNode | undefined;
  const entries: SheetListEntry[] = [];

  function pushItems(
    categoryKey: string,
    items: SheetAction[],
    preferDefault: boolean,
  ) {
    for (const item of items) {
      entries.push({
        action: item,
        categoryKey,
        priority: listPriority(categoryKey, item.key, preferDefault),
      });
    }
  }

  for (const action of actions) {
    if (action.infoContent) {
      infoContent = action.infoContent;
      continue;
    }
    if (action.subActions && action.subActions.length > 0) {
      const items = usableFirst(action.subActions);
      categoryFilters.push({
        key: action.key,
        label: action.title,
        kind: "list",
        items,
        upgradeAvailable: action.upgradeAvailable || anyUpgradeAvailable(items),
        preferDefault: action.preferDefault,
      });
      pushItems(action.key, items, !!action.preferDefault);
      continue;
    }
    leafActions.push(action);
  }

  const upgradeLeaves = usableFirst(leafActions.filter(isUpgradeLeaf));
  const otherLeaves = usableFirst(leafActions.filter((a) => !isUpgradeLeaf(a)));

  const filters: SheetFilter[] = [];

  // In-progress first among category filters when present (#74).
  const inProgressFilter = categoryFilters.find((f) => f.key === "in-progress");
  const otherCategoryFilters = categoryFilters.filter((f) => f.key !== "in-progress");
  if (inProgressFilter) {
    filters.push(inProgressFilter);
  }

  if (upgradeLeaves.length > 0) {
    const upgradesFilter: SheetFilter = {
      key: "upgrades",
      label: "Upgrades",
      kind: "list",
      items: upgradeLeaves,
      upgradeAvailable: anyUpgradeAvailable(upgradeLeaves),
    };
    filters.push(upgradesFilter);
    pushItems("upgrades", upgradeLeaves, false);
  }

  filters.push(...otherCategoryFilters);

  if (otherLeaves.length > 0) {
    const actionsFilter: SheetFilter = {
      key: "actions",
      label: "Actions",
      kind: "list",
      items: otherLeaves,
      upgradeAvailable: anyUpgradeAvailable(otherLeaves),
    };
    filters.push(actionsFilter);
    // Classify each leaf by its own key (collect vs garrison vs demolish).
    // Closest-only groups (scrap-yard stash targets): Actions keeps every
    // stash; All only gets the nearest by `distance`.
    const closestByGroup = new Map<string, SheetAction>();
    for (const item of otherLeaves) {
      const group = item.allListClosestGroup;
      if (group != null && item.distance != null) {
        const prev = closestByGroup.get(group);
        if (!prev || item.distance < (prev.distance ?? Number.POSITIVE_INFINITY)) {
          closestByGroup.set(group, item);
        }
        continue;
      }
      entries.push({
        action: item,
        categoryKey: "actions",
        priority: listPriority("actions", item.key, false),
      });
    }
    for (const item of closestByGroup.values()) {
      entries.push({
        action: item,
        categoryKey: "actions",
        priority: listPriority("actions", item.key, false),
      });
    }
  }

  if (infoContent) {
    filters.push({
      key: "info",
      label: "Info",
      kind: "info",
      infoContent,
    });
  }

  const listFilters = filters.filter((f) => f.kind === "list");
  const allEntries = sortEntries(entries);

  // Prefixed All filter whenever there is anything to filter.
  const withAll: SheetFilter[] =
    listFilters.length > 0
      ? [
          {
            key: "all",
            label: "All",
            kind: "all",
            items: allEntries.map((e) => e.action),
            upgradeAvailable: anyUpgradeAvailable(allEntries.map((e) => e.action)),
          },
          ...filters,
        ]
      : filters;

  return { filters: withAll, allEntries };
}

/** @deprecated Prefer deriveSheetModel — kept name for older call sites/tests. */
export function deriveSheetTabs(actions: SheetAction[]): SheetFilter[] {
  return deriveSheetModel(actions).filters;
}

/** Default filter: All when present; otherwise first filter. */
export function defaultFilterKey(filters: SheetFilter[]): string | null {
  if (filters.length === 0) return null;
  const all = filters.find((f) => f.key === "all");
  if (all) return all.key;
  return filters[0]?.key ?? null;
}

/** Exported for unit tests — alias matching the old tab API. */
export function defaultTabKey(filters: SheetFilter[]): string | null {
  return defaultFilterKey(filters);
}

/**
 * When a preferDefault Garrison category exists, open its form immediately
 * (All filter still selected — form overlays the list). Skip when In progress
 * or arrival orders are present — those outrank the horde shortcut (#74 / #73).
 */
export function defaultOpenFormKey(filters: SheetFilter[], _filterKey: string | null): string | null {
  if (filters.some((f) => f.key === "in-progress" || f.key === "arrival-orders")) return null;
  const preferred = filters.find((f) => f.kind === "list" && f.preferDefault);
  if (!preferred) return null;
  const formItem = preferred.items?.find((a) => a.formContent != null && !a.disabled);
  return formItem?.key ?? null;
}

/**
 * Bottom-sheet tile menu: one combined list + optional category filters.
 * Forms open inline; Info is its own filter.
 */
export function TileActionSheet({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const model = useMemo(() => deriveSheetModel(actions), [actions]);
  const { filters, allEntries } = model;
  const filterSignature = filters
    .map((f) => `${f.key}:${f.preferDefault ? "1" : "0"}`)
    .join("|");
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(() => defaultFilterKey(filters));
  const [openFormKey, setOpenFormKey] = useState<string | null>(() =>
    defaultOpenFormKey(filters, defaultFilterKey(filters)),
  );

  // Preserve the active filter across GameScreen re-renders (action trees are
  // rebuilt every tick); only re-pick a default when the filter set changes.
  useEffect(() => {
    let openedForm: string | null | undefined;
    setActiveFilterKey((current) => {
      if (current && filters.some((f) => f.key === current)) return current;
      const next = defaultFilterKey(filters);
      openedForm = defaultOpenFormKey(filters, next);
      return next;
    });
    if (openedForm !== undefined) setOpenFormKey(openedForm);
  }, [filterSignature, filters]);

  const activeFilter = filters.find((f) => f.key === activeFilterKey) ?? filters[0] ?? null;

  const visibleActions: SheetAction[] = (() => {
    if (!activeFilter) return [];
    if (activeFilter.kind === "all") return allEntries.map((e) => e.action);
    if (activeFilter.kind === "list") {
      // Use the filter's full item list (so Actions keeps every scrap stash),
      // sorted with the same usable-first + priority rules as All.
      const items = activeFilter.items ?? [];
      const sorted = sortEntries(
        items.map((item) => ({
          action: item,
          categoryKey: activeFilter.key,
          priority: listPriority(activeFilter.key, item.key, !!activeFilter.preferDefault),
        })),
      );
      return sorted.map((e) => e.action);
    }
    return [];
  })();

  const openFormAction = (() => {
    if (!openFormKey) return undefined;
    const fromAll = allEntries.find((e) => e.action.key === openFormKey && e.action.formContent);
    return fromAll?.action;
  })();

  function handleRowClick(action: SheetAction) {
    if (action.disabled) return;
    if (action.formContent) {
      setOpenFormKey((k) => (k === action.key ? null : action.key));
      return;
    }
    action.onClick?.();
  }

  function selectFilter(filterKey: string) {
    setActiveFilterKey(filterKey);
    setOpenFormKey(null);
  }

  // Show pills when there is more than one way to view content (All + ≥1
  // category, or Info alongside a list).
  const showFilterBar = filters.length > 2 || (filters.length === 2 && filters.some((f) => f.kind === "info"));

  const filterBar =
    showFilterBar ? (
      <div
        role="toolbar"
        aria-label="Action filters"
        style={{
          display: "flex",
          gap: "0.35rem",
          overflowX: "auto",
          paddingBottom: "0.15rem",
        }}
      >
        {filters.map((filter) => {
          const active = filter.key === activeFilter?.key;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active}
              onClick={() => selectFilter(filter.key)}
              style={{
                flex: "0 0 auto",
                background: active ? "rgba(255, 255, 255, 0.14)" : "transparent",
                border: filter.upgradeAvailable
                  ? `1px solid ${UPGRADE_AVAILABLE_BADGE_COLOR}`
                  : "1px solid rgba(255, 255, 255, 0.2)",
                color: filter.upgradeAvailable && !active ? UPGRADE_AVAILABLE_BADGE_COLOR : "white",
                borderRadius: 8,
                padding: "0.4rem 0.7rem",
                fontSize: "0.8rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    ) : undefined;

  return (
    <BottomSheet
      open
      title={title}
      onClose={onClose}
      toolbar={filterBar}
      scrollKey={`${activeFilter?.key ?? ""}:${openFormKey ?? ""}`}
    >
      {openFormAction ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setOpenFormKey(null)}
              aria-label="Back"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "white",
                borderRadius: 8,
                width: 36,
                height: 36,
                padding: 0,
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{openFormAction.icon}</span>
            <strong style={{ fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {openFormAction.title}
            </strong>
          </div>
          {openFormAction.formContent}
        </div>
      ) : activeFilter?.kind === "info" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
          {activeFilter.infoContent}
        </div>
      ) : visibleActions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {visibleActions.map((action) => (
            <ActionRow key={action.key} action={action} onClick={() => handleRowClick(action)} />
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>No actions available.</p>
      )}
    </BottomSheet>
  );
}

const ROW_SHELL: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: "0.35rem",
  width: "100%",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 8,
  padding: "0.35rem 0.35rem 0.35rem 0.65rem",
  color: "white",
};

function ActionRow({ action, onClick }: { action: SheetAction; onClick: () => void }) {
  const interactive = !action.disabled && (!!action.onClick || !!action.formContent);
  const quickActions = action.quickActions ?? [];
  const hasQuick = quickActions.length > 0;
  const upgradeBorder = action.upgradeAvailable
    ? `1px solid ${UPGRADE_AVAILABLE_BADGE_COLOR}`
    : "1px solid rgba(255, 255, 255, 0.1)";
  const upgradeBg = action.upgradeAvailable ? "rgba(224, 142, 11, 0.12)" : "rgba(255, 255, 255, 0.04)";

  const label = (
    <>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{action.icon}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{action.title}</span>
        {action.detail && <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>{action.detail}</span>}
      </span>
    </>
  );

  if (!hasQuick) {
    return (
      <button
        type="button"
        disabled={action.disabled || (!action.onClick && !action.formContent)}
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          width: "100%",
          textAlign: "left",
          background: upgradeBg,
          border: upgradeBorder,
          borderRadius: 8,
          padding: "0.65rem 0.75rem",
          color: "white",
          cursor: interactive ? "pointer" : "default",
          opacity: action.disabled ? 0.45 : 1,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        ...ROW_SHELL,
        background: upgradeBg,
        border: upgradeBorder,
        opacity: action.disabled ? 0.45 : 1,
      }}
    >
      <button
        type="button"
        disabled={action.disabled || (!action.onClick && !action.formContent)}
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          flex: "1 1 auto",
          minWidth: 0,
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "0.3rem 0.25rem",
          color: "inherit",
          cursor: interactive ? "pointer" : "default",
        }}
      >
        {label}
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          flexShrink: 0,
          paddingRight: "0.15rem",
        }}
      >
        {quickActions.map((qa) => {
          const qaDisabled = !!action.disabled || !!qa.disabled;
          return (
            <button
              key={qa.label}
              type="button"
              disabled={qaDisabled}
              onClick={(event) => {
                event.stopPropagation();
                if (qaDisabled) return;
                qa.onClick();
              }}
              style={{
                flexShrink: 0,
                height: 32,
                minWidth: 32,
                padding: "0 0.45rem",
                borderRadius: 7,
                border: "1px solid rgba(255, 255, 255, 0.22)",
                background: "rgba(255, 255, 255, 0.08)",
                color: "white",
                fontSize: "0.72rem",
                fontWeight: 650,
                cursor: qaDisabled ? "default" : "pointer",
                opacity: qaDisabled ? 0.4 : 1,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {qa.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
