import { describe, expect, it } from "vitest";
import { defaultOpenFormKey, defaultTabKey, deriveSheetTabs, type SheetAction } from "./TileActionSheet";

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
        subActions: [leaf({ key: "build-power-station", title: "Build power station" })],
      },
    ];

    expect(deriveSheetTabs(actions).map((t) => t.key)).toEqual(["build-civil", "actions"]);
  });

  it("gives base garrison its own category tab beside storage", () => {
    const actions: SheetAction[] = [
      leaf({ key: "base-upgrade", title: "Upgrade base to L2", upgradeAvailable: true }),
      {
        key: "storage-upgrade",
        icon: null,
        title: "Storage",
        subActions: [leaf({ key: "food", title: "food → L2" })],
      },
      {
        key: "garrison",
        icon: null,
        title: "Garrison",
        subActions: [leaf({ key: "garrison-manage", title: "Garrison" })],
      },
    ];

    const tabs = deriveSheetTabs(actions);
    expect(tabs.map((t) => t.key)).toEqual(["upgrades", "storage-upgrade", "garrison"]);
    expect(tabs[2]?.items?.map((i) => i.key)).toEqual(["garrison-manage"]);
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

  it("puts In progress ahead of Upgrades when a tile has active timers", () => {
    const actions: SheetAction[] = [
      leaf({
        key: "tower-upgrade",
        title: "Upgrade to L2",
        upgradeAvailable: true,
      }),
      {
        key: "in-progress",
        icon: null,
        title: "In progress",
        subActions: [leaf({ key: "busy-tower-build", title: "Building tower", detail: "2m remaining" })],
      },
      leaf({ key: "demolish", title: "Demolish" }),
    ];

    const tabs = deriveSheetTabs(actions);
    expect(tabs.map((t) => t.key)).toEqual(["in-progress", "upgrades", "actions"]);
    expect(tabs[0]?.items?.map((i) => i.key)).toEqual(["busy-tower-build"]);
  });

  it("prefers a preferDefault Garrison tab over upgrade highlights", () => {
    const actions: SheetAction[] = [
      leaf({
        key: "tower-upgrade",
        title: "Upgrade to L2",
        upgradeAvailable: true,
      }),
      {
        key: "garrison",
        icon: null,
        title: "Garrison",
        preferDefault: true,
        subActions: [
          leaf({
            key: "garrison-manage",
            title: "Garrison",
            formContent: "form",
          }),
        ],
      },
    ];

    const tabs = deriveSheetTabs(actions);
    expect(defaultTabKey(tabs)).toBe("garrison");
    expect(defaultOpenFormKey(tabs, "garrison")).toBe("garrison-manage");
  });

  it("still ranks In progress above preferDefault Garrison", () => {
    const actions: SheetAction[] = [
      {
        key: "in-progress",
        icon: null,
        title: "In progress",
        subActions: [leaf({ key: "busy", title: "Building" })],
      },
      {
        key: "garrison",
        icon: null,
        title: "Garrison",
        preferDefault: true,
        subActions: [leaf({ key: "garrison-manage", title: "Garrison", formContent: "form" })],
      },
    ];

    const tabs = deriveSheetTabs(actions);
    expect(defaultTabKey(tabs)).toBe("in-progress");
    expect(defaultOpenFormKey(tabs, "in-progress")).toBeNull();
  });
});
