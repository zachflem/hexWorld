import { BottomSheet } from "../primitives/BottomSheet";
import { SheetButton } from "../primitives/SheetButton";
import { SheetInfoCard } from "../primitives/SheetListItem";

/** Dev Show-lab cycle: off → final-clue search hint → exact lab tile. */
export type DevLabMode = "off" | "hint" | "reveal";

const DEV_LAB_MODE_LABEL: Record<DevLabMode, string> = {
  off: "Off",
  hint: "Show hint",
  reveal: "Reveal lab",
};

/**
 * Dev-server-only playtest tools — same BottomSheet / SheetButton language as
 * Settings. Sticky toggles (session-local). Gated by the caller with
 * `import.meta.env.DEV`; never shipped in production UI.
 */
export function DevToolsPanel({
  fogDisabled,
  speed10x,
  labMode,
  onToggleFog,
  onToggleSpeed10x,
  onCycleLabMode,
  onRerollSeed,
  onClose,
}: {
  fogDisabled: boolean;
  speed10x: boolean;
  labMode: DevLabMode;
  onToggleFog: () => void;
  onToggleSpeed10x: () => void;
  onCycleLabMode: () => void;
  onRerollSeed: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open title="Dev tools" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <SheetInfoCard>
          <strong style={{ fontSize: "0.95rem" }}>Dev only</strong>
          <span style={{ opacity: 0.75, fontSize: "0.85rem", lineHeight: 1.4 }}>
            Session-local helpers for playtesting. Not persisted; stripped from production builds.
          </span>
        </SheetInfoCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <SheetButton variant="secondary" onClick={onToggleFog}>
            Disable fog: {fogDisabled ? "On" : "Off"}
          </SheetButton>
          <SheetButton variant="secondary" onClick={onToggleSpeed10x}>
            10x speed: {speed10x ? "On" : "Off"}
          </SheetButton>
          <SheetButton variant="secondary" onClick={onCycleLabMode}>
            Lab: {DEV_LAB_MODE_LABEL[labMode]}
          </SheetButton>
          <SheetButton variant="secondary" onClick={onRerollSeed}>
            Re-roll seed
          </SheetButton>
        </div>
      </div>
    </BottomSheet>
  );
}
