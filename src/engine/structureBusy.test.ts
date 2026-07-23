import { describe, expect, it } from "vitest";
import {
  isBarracksBusy,
  isDockBusy,
  isHordeRepairBlocked,
  isLandStructureBusy,
  isOutpostReinforcementBusy,
  isWallBusy,
} from "./structureBusy";

describe("structureBusy", () => {
  it("isLandStructureBusy covers build, upgrade, and horde repair", () => {
    const idle = {};
    expect(isLandStructureBusy(idle)).toBe(false);
    expect(isLandStructureBusy({ buildStartedAt: 0 })).toBe(true);
    expect(isLandStructureBusy({ upgrade: { targetTier: "medium", startedAt: 0 } })).toBe(true);
    expect(isLandStructureBusy({ damageRepair: { startedAt: 0 } })).toBe(true);
  });

  it("isWallBusy includes the unified action slot", () => {
    expect(isWallBusy({ action: { kind: "upgrade", targetTier: "rock", startedAt: 0 } })).toBe(true);
    expect(isWallBusy({ buildStartedAt: 0 })).toBe(true);
  });

  it("isDockBusy covers dock build and fishing boat", () => {
    expect(isDockBusy({ buildStartedAt: 0 })).toBe(true);
    expect(isDockBusy({ fishingBoatUpgrade: { startedAt: 0 } })).toBe(true);
  });

  it("isBarracksBusy includes training queue", () => {
    expect(isBarracksBusy({ trainingQueue: { unitType: "scout", remaining: 1, currentUnitStartedAt: 0 } })).toBe(true);
    expect(isBarracksBusy({ upgrade: { targetLevel: 2, startedAt: 0 } })).toBe(true);
  });

  it("isHordeRepairBlocked treats wall action like other busy slots", () => {
    expect(isHordeRepairBlocked({ action: { kind: "repair", startedAt: 0 } })).toBe(true);
    expect(isHordeRepairBlocked({ upgrade: { targetTier: "medium", startedAt: 0 } })).toBe(true);
  });

  it("isOutpostReinforcementBusy mirrors base.action pattern", () => {
    expect(isOutpostReinforcementBusy({})).toBe(false);
    expect(isOutpostReinforcementBusy({ reinforcementAction: { kind: "upgrade", targetLevel: 1, startedAt: 0 } })).toBe(
      true,
    );
  });
});
