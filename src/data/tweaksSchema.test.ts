import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "./tweaksSchema";

describe("tweaksSchema", () => {
  it("validates the real public/tweaks.jsonc file", () => {
    const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
    const parsed = JSON.parse(stripJsonComments(raw));

    const result = tweaksSchema.safeParse(parsed);

    expect(result.success).toBe(true);
  });

  it("validates shipped profile tweaks files", () => {
    for (const slug of ["default", "hard"] as const) {
      const raw = readFileSync(resolve(__dirname, `../../public/profiles/${slug}/tweaks.jsonc`), "utf-8");
      const parsed = JSON.parse(stripJsonComments(raw));
      const result = tweaksSchema.safeParse(parsed);
      expect(result.success, slug).toBe(true);
      if (result.success) {
        expect(result.data.meta.slug).toBe(slug);
      }
    }
  });

  it("rejects a malformed config", () => {
    const result = tweaksSchema.safeParse({ meta: { version: "0.1.0" } });

    expect(result.success).toBe(false);
  });
});
