import { describe, expect, it } from "vitest";
import { deriveSheetTabs, type SheetAction } from "./TileActionSheet";

function leaf(partial: Partial<SheetAction> & Pick<SheetAction, "key" | "title">): SheetAction {
  return { icon: null, ...partial };
}

describe("deriveSheetTabs", () => {
  it("puts Upgrades first, category tabs next, Actions before Info", () => {
    const actions: SheetAction[] = [
      leaf({ key: "garrison", title: "Garrison" }),
      leaf({
        key: "tower-upgrade",
        title: "Upgrade to L2",
        upgradeAvailable: true,
      }),
      {
        key: "train",
        icon: null,
        title: "Train",
        subActions: [leaf({ key: "train-militia", title: "Militia" })],
      },
      leaf({ key: "info", title: "Info", infoContent: "stats" }),
    ];

    const tabs = deriveSheetTabs(actions);
    expect(tabs.map((t) => t.key)).toEqual(["upgrades", "train", "actions", "info"]);
    expect(tabs[0]?.items?.map((i) => i.key)).toEqual(["tower-upgrade"]);
    expect(tabs[2]?.items?.map((i) => i.key)).toEqual(["garrison"]);
  });

  it("keeps Actions last when there are no upgrades", () => {
    const actions: SheetAction[] = [
      leaf({ key: "collect", title: "Collect" }),
      {
        key: "build-civil",
        icon: null,
        title: "Civil",
        subActions: [leaf({ key: "build-path", title: "Build goat track" })],
      },
    ];

    expect(deriveSheetTabs(actions).map((t) => t.key)).toEqual(["build-civil", "actions"]);
  });

  it("groups reinforcement upgrades under Upgrades even when unaffordable", () => {
    const actions: SheetAction[] = [
      leaf({
        key: "base-reinforce",
        title: "Upgrade reinforcement to 120 HP",
        disabled: true,
        upgradeAvailable: false,
      }),
      leaf({ key: "base-repair", title: "Repair base" }),
    ];

    const tabs = deriveSheetTabs(actions);
    expect(tabs.map((t) => t.key)).toEqual(["upgrades", "actions"]);
    expect(tabs[0]?.upgradeAvailable).toBe(false);
    expect(tabs[0]?.items?.map((i) => i.key)).toEqual(["base-reinforce"]);
    expect(tabs[1]?.items?.map((i) => i.key)).toEqual(["base-repair"]);
  });
});
