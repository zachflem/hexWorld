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
  detail?: string;
  disabled?: boolean;
  /**
   * True if this action itself is an affordable upgrade — OR (for a category)
   * if any descendant has this set. Lights the row/tab with the same orange
   * used for map upgrade badges.
   */
  upgradeAvailable?: boolean;
  onClick?: () => void;
  /** Category tab: items listed when this tab is active. */
  subActions?: SheetAction[];
  /** Inline form shown when the row is chosen (garrison, train, party dispatch). */
  formContent?: ReactNode;
  /** Read-only body for the Info tab (replaces the old dialogContent popover). */
  infoContent?: ReactNode;
  /**
   * Compact commit shortcuts rendered beside the row (e.g. train +1 / +5 / Max).
   * Kept outside the main row button so they stay tappable without opening the form.
   */
  quickActions?: SheetQuickAction[];
}

interface SheetTab {
  key: string;
  label: string;
  kind: "list" | "info";
  items?: SheetAction[];
  infoContent?: ReactNode;
  upgradeAvailable?: boolean;
}

function anyUpgradeAvailable(actions: SheetAction[]): boolean {
  return actions.some((a) => a.upgradeAvailable || (a.subActions && anyUpgradeAvailable(a.subActions)));
}

/** Usable actions first; disabled (e.g. unaffordable) sink to the bottom. Stable among peers. */
function usableFirst(actions: SheetAction[]): SheetAction[] {
  return [...actions].sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled));
}

/**
 * Leaf upgrades that used to land in the catch-all Actions tab — structure
 * level/tier/reinforcement upgrades. Detected by key/title so unaffordable
 * options still group under Upgrades (not only when `upgradeAvailable`).
 */
function isUpgradeLeaf(action: SheetAction): boolean {
  const key = action.key.toLowerCase();
  if (key.includes("upgrade") || key.includes("reinforce")) return true;
  return action.title.toLowerCase().startsWith("upgrade");
}

/** Derive category tabs from the root action tree. */
export function deriveSheetTabs(actions: SheetAction[]): SheetTab[] {
  const categoryTabs: SheetTab[] = [];
  const leafActions: SheetAction[] = [];
  let infoContent: ReactNode | undefined;

  for (const action of actions) {
    if (action.infoContent) {
      infoContent = action.infoContent;
      continue;
    }
    if (action.subActions && action.subActions.length > 0) {
      const items = usableFirst(action.subActions);
      categoryTabs.push({
        key: action.key,
        label: action.title,
        kind: "list",
        items,
        upgradeAvailable: action.upgradeAvailable || anyUpgradeAvailable(items),
      });
      continue;
    }
    leafActions.push(action);
  }

  const upgradeLeaves = usableFirst(leafActions.filter(isUpgradeLeaf));
  const otherLeaves = usableFirst(leafActions.filter((a) => !isUpgradeLeaf(a)));

  const tabs: SheetTab[] = [];

  // In-progress status first when present — the player opened this tile to
  // see what's already running (#74). Prefer it over Upgrades for defaultTabKey.
  const inProgressTab = categoryTabs.find((tab) => tab.key === "in-progress");
  const otherCategoryTabs = categoryTabs.filter((tab) => tab.key !== "in-progress");
  if (inProgressTab) {
    tabs.push(inProgressTab);
  }

  // Upgrades next so a clickable upgraded building opens on that tab by
  // default when nothing is in progress (see defaultTabKey).
  if (upgradeLeaves.length > 0) {
    tabs.push({
      key: "upgrades",
      label: "Upgrades",
      kind: "list",
      items: upgradeLeaves,
      upgradeAvailable: anyUpgradeAvailable(upgradeLeaves),
    });
  }

  tabs.push(...otherCategoryTabs);

  // Actions last among commit tabs — Collect / Garrison / Demolish / Repair
  // and one-off leaf commits. Build / Train categories stay ahead of it.
  if (otherLeaves.length > 0) {
    tabs.push({
      key: "actions",
      label: "Actions",
      kind: "list",
      items: otherLeaves,
      upgradeAvailable: anyUpgradeAvailable(otherLeaves),
    });
  }

  if (infoContent) {
    tabs.push({
      key: "info",
      label: "Info",
      kind: "info",
      infoContent,
    });
  }

  return tabs;
}

function defaultTabKey(tabs: SheetTab[]): string | null {
  if (tabs.length === 0) return null;
  // Busy work on this tile outranks upgrade highlights — the sheet should
  // open on what's already happening (#74).
  const inProgress = tabs.find((t) => t.key === "in-progress");
  if (inProgress) return inProgress.key;
  // Prefer an affordable upgrade highlight when present; otherwise the first
  // tab (Upgrades if that group exists, else Build/Train/etc.).
  const withUpgrade = tabs.find((t) => t.upgradeAvailable);
  return (withUpgrade ?? tabs[0]).key;
}

/**
 * Bottom-sheet tile menu: category tabs + detail rows. Replaces the old
 * TileActionRing honeycomb overlay. Forms open inline; Info is its own tab.
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
  const tabs = useMemo(() => deriveSheetTabs(actions), [actions]);
  const tabSignature = tabs.map((t) => t.key).join("|");
  const [activeTabKey, setActiveTabKey] = useState<string | null>(() => defaultTabKey(tabs));
  const [openFormKey, setOpenFormKey] = useState<string | null>(null);

  // Preserve the active tab across GameScreen re-renders (action trees are
  // rebuilt every tick); only re-pick a default when the tab set itself changes.
  useEffect(() => {
    setActiveTabKey((current) => {
      if (current && tabs.some((t) => t.key === current)) return current;
      return defaultTabKey(tabs);
    });
  }, [tabSignature, tabs]);

  useEffect(() => {
    setOpenFormKey(null);
  }, [activeTabKey]);

  const activeTab = tabs.find((t) => t.key === activeTabKey) ?? tabs[0] ?? null;
  const openFormAction =
    activeTab?.kind === "list" ? activeTab.items?.find((a) => a.key === openFormKey && a.formContent) : undefined;

  function handleRowClick(action: SheetAction) {
    if (action.disabled) return;
    if (action.formContent) {
      setOpenFormKey((k) => (k === action.key ? null : action.key));
      return;
    }
    action.onClick?.();
  }

  const tabBar =
    tabs.length > 1 ? (
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "0.35rem",
          overflowX: "auto",
          paddingBottom: "0.15rem",
        }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab?.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTabKey(tab.key)}
              style={{
                flex: "0 0 auto",
                background: active ? "rgba(255, 255, 255, 0.14)" : "transparent",
                border: tab.upgradeAvailable
                  ? `1px solid ${UPGRADE_AVAILABLE_BADGE_COLOR}`
                  : "1px solid rgba(255, 255, 255, 0.2)",
                color: tab.upgradeAvailable && !active ? UPGRADE_AVAILABLE_BADGE_COLOR : "white",
                borderRadius: 8,
                padding: "0.4rem 0.7rem",
                fontSize: "0.8rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
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
      toolbar={tabBar}
      scrollKey={`${activeTab?.key ?? ""}:${openFormKey ?? ""}`}
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
      ) : activeTab?.kind === "info" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
          {activeTab.infoContent}
        </div>
      ) : activeTab?.items && activeTab.items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {activeTab.items.map((action) => (
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
