import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { UPGRADE_AVAILABLE_BADGE_COLOR } from "../../render/HexCanvas";
import { BottomSheet } from "../primitives/BottomSheet";

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

/** Derive category tabs from the root action tree. */
export function deriveSheetTabs(actions: SheetAction[]): SheetTab[] {
  const tabs: SheetTab[] = [];
  const leafActions: SheetAction[] = [];
  let infoContent: ReactNode | undefined;

  for (const action of actions) {
    if (action.infoContent) {
      infoContent = action.infoContent;
      continue;
    }
    if (action.subActions && action.subActions.length > 0) {
      tabs.push({
        key: action.key,
        label: action.title,
        kind: "list",
        items: action.subActions,
        upgradeAvailable: action.upgradeAvailable || anyUpgradeAvailable(action.subActions),
      });
      continue;
    }
    leafActions.push(action);
  }

  if (leafActions.length > 0) {
    tabs.unshift({
      key: "actions",
      label: "Actions",
      kind: "list",
      items: leafActions,
      upgradeAvailable: anyUpgradeAvailable(leafActions),
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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <button
            type="button"
            onClick={() => setOpenFormKey(null)}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "transparent",
              border: "none",
              color: "rgba(255, 255, 255, 0.85)",
              padding: 0,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-flex" }}>{openFormAction.icon}</span>
            <strong>{openFormAction.title}</strong>
          </div>
          {openFormAction.detail && <span style={{ opacity: 0.75, fontSize: "0.8rem" }}>{openFormAction.detail}</span>}
          <div>{openFormAction.formContent}</div>
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

function ActionRow({ action, onClick }: { action: SheetAction; onClick: () => void }) {
  const interactive = !action.disabled && (!!action.onClick || !!action.formContent);
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
        background: action.upgradeAvailable ? "rgba(224, 142, 11, 0.12)" : "rgba(255, 255, 255, 0.04)",
        border: action.upgradeAvailable
          ? `1px solid ${UPGRADE_AVAILABLE_BADGE_COLOR}`
          : "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
        color: "white",
        cursor: interactive ? "pointer" : "default",
        opacity: action.disabled ? 0.45 : 1,
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{action.icon}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{action.title}</span>
        {action.detail && <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>{action.detail}</span>}
      </span>
    </button>
  );
}
