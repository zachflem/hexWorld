import { describe, expect, it } from "vitest";
import { parseSeedInput } from "./parseSeedInput";

describe("parseSeedInput", () => {
  it("accepts blank input as random seed", () => {
    expect(parseSeedInput("")).toEqual({ ok: true });
    expect(parseSeedInput("   ")).toEqual({ ok: true });
  });

  it("accepts non-negative integers", () => {
    expect(parseSeedInput("0")).toEqual({ ok: true, seed: 0 });
    expect(parseSeedInput(" 42 ")).toEqual({ ok: true, seed: 42 });
  });

  it("rejects invalid seeds", () => {
    expect(parseSeedInput("abc")).toEqual({
      ok: false,
      error: "Seed must be a whole number",
    });
    expect(parseSeedInput("1.5")).toEqual({
      ok: false,
      error: "Seed must be a whole number",
    });
    expect(parseSeedInput("-1")).toEqual({
      ok: false,
      error: "Seed must be a whole number",
    });
  });
});
