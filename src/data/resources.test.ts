import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "./tweaksSchema";
import { initialResourceAmounts } from "./resources";

describe("initialResourceAmounts", () => {
  it("extracts only the 5 numeric resource fields from the real tweaks.jsonc", () => {
    const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
    const tweaks = tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));

    const amounts = initialResourceAmounts(tweaks);

    expect(amounts).toEqual({ food: 100, wood: 500, stone: 400, steel: 0, power: 0 });
  });
});
