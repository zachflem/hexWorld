import { describe, expect, it } from "vitest";
import {
  defaultOpenFormKey,
  defaultFilterKey,
  deriveSheetModel,
  listPriority,
  type SheetAction,
} from "./TileActionSheet";

function leaf(partial: Partial<SheetAction> & Pick<SheetAction, "key" | "title">): SheetAction {
  return { icon: null, ...partial };
}

describe("listPriority", () => {
  it("ranks tile tasks above upgrades, garrison, and other", () => {
    expect(listPriority("train", "train-militia", false)).toBe(1);
    expect(listPriority("actions", "collect", false)).toBe(1);
    expect(listPriority("upgrades", "tower-upgrade", false)).toBe(2);
    expect(listPriority("garrison", "garrison-manage", false)).toBe(3);
    expect(listPriority("build-civil", "build-power-station", false)).toBe(4);
    expect(listPriority("actions", "demolish", false)).toBe(4);
  });

  it("boosts preferDefault Garrison above tile tasks", () => {
    expect(listPriority("garrison", "garrison-manage", true)).toBe(0);
  });

  it("keeps in-progress / arrival orders urgent", () => {
    expect(listPriority("in-progress", "busy-tower-build", false)).toBe(0);
    expect(listPriority("arrival-orders", "arrival-redeploy", false)).toBe(0);
  });
});

describe("deriveSheetModel", () => {
  it("prefixes All and keeps category filters for narrowing", () => {
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(filters.map((t) => t.key)).toEqual(["all", "upgrades", "train", "actions", "info"]);
    expect(allEntries.map((e) => e.action.key)).toEqual(["train-militia", "tower-upgrade", "garrison"]);
  });

  it("sorts usable tile tasks before upgrades before other; disabled sink", () => {
    const actions: SheetAction[] = [
      leaf({ key: "demolish", title: "Demolish" }),
      leaf({
        key: "tower-upgrade",
        title: "Upgrade to L2",
        disabled: true,
        upgradeAvailable: false,
      }),
      leaf({ key: "collect", title: "Collect" }),
      leaf({
        key: "base-upgrade",
        title: "Upgrade base to L2",
        upgradeAvailable: true,
      }),
    ];

    const { allEntries } = deriveSheetModel(actions);
    expect(allEntries.map((e) => e.action.key)).toEqual([
      "collect",
      "base-upgrade",
      "demolish",
      "tower-upgrade",
    ]);
  });

  it("puts Garrison ahead of everything when preferDefault (horde threat)", () => {
    const actions: SheetAction[] = [
      leaf({ key: "collect", title: "Collect" }),
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(allEntries.map((e) => e.action.key)).toEqual([
      "garrison-manage",
      "collect",
      "tower-upgrade",
    ]);
    expect(defaultFilterKey(filters)).toBe("all");
    expect(defaultOpenFormKey(filters, "all")).toBe("garrison-manage");
  });

  it("gives base garrison its own filter beside storage", () => {
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(filters.map((t) => t.key)).toEqual(["all", "upgrades", "storage-upgrade", "garrison"]);
    // Storage + base upgrade share the upgrades band; garrison trails.
    expect(allEntries.map((e) => e.action.key)).toEqual(["food", "base-upgrade", "garrison-manage"]);
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(filters.map((t) => t.key)).toEqual(["all", "upgrades", "actions"]);
    expect(filters.find((f) => f.key === "upgrades")?.upgradeAvailable).toBe(false);
    expect(allEntries.map((e) => e.action.key)).toEqual(["base-repair", "base-reinforce"]);
    expect(allEntries.find((e) => e.action.key === "base-reinforce")?.categoryKey).toBe("upgrades");
  });

  it("puts In progress at the top of the All list", () => {
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(filters.map((t) => t.key)).toEqual(["all", "in-progress", "upgrades", "actions"]);
    expect(allEntries.map((e) => e.action.key)).toEqual([
      "busy-tower-build",
      "tower-upgrade",
      "demolish",
    ]);
  });

  it("still ranks In progress above preferDefault Garrison in the list", () => {
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

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(defaultFilterKey(filters)).toBe("all");
    expect(allEntries.map((e) => e.action.key)).toEqual(["busy", "garrison-manage"]);
    // In-progress outranks auto-opening the garrison form.
    expect(defaultOpenFormKey(filters, "all")).toBeNull();
  });

  it("defaults to All even when an upgrade is available", () => {
    const actions: SheetAction[] = [
      leaf({
        key: "tower-upgrade",
        title: "Upgrade to L2",
        upgradeAvailable: true,
      }),
      {
        key: "build-civil",
        icon: null,
        title: "Civil",
        subActions: [leaf({ key: "build-power-station", title: "Build power station" })],
      },
    ];

    const { filters } = deriveSheetModel(actions);
    expect(defaultFilterKey(filters)).toBe("all");
  });

  it("scrap yard: All shows only closest stash; Actions keeps every stash", () => {
    const actions: SheetAction[] = [
      leaf({
        key: "scrap-yard-upgrade",
        title: "Upgrade to L2",
        upgradeAvailable: true,
      }),
      leaf({
        key: "scrapper-assign-near",
        title: "Assign Scrapper — stash (10 steel)",
        distance: 2,
        allListClosestGroup: "scrapper-assign",
      }),
      leaf({
        key: "scrapper-assign-far",
        title: "Assign Scrapper — stash (40 steel)",
        distance: 8,
        allListClosestGroup: "scrapper-assign",
      }),
      leaf({ key: "collect-scrap-yard", title: "Collect" }),
      leaf({ key: "demolish", title: "Demolish" }),
    ];

    const { filters, allEntries } = deriveSheetModel(actions);
    expect(allEntries.map((e) => e.action.key)).toEqual([
      "collect-scrap-yard",
      "scrapper-assign-near",
      "scrap-yard-upgrade",
      "demolish",
    ]);
    const actionsFilter = filters.find((f) => f.key === "actions");
    expect(actionsFilter?.items?.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        "scrapper-assign-near",
        "scrapper-assign-far",
        "collect-scrap-yard",
        "demolish",
      ]),
    );
    expect(actionsFilter?.items).toHaveLength(4);
  });
});
