import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_SLUG, isValidProfileSlug, resolveProfileSlug } from "./profileRegistry";

describe("profileRegistry", () => {
  it("resolves slug from pathname", () => {
    expect(resolveProfileSlug("/hard")).toBe("hard");
    expect(resolveProfileSlug("/hard/")).toBe("hard");
    expect(resolveProfileSlug("/")).toBeNull();
    expect(resolveProfileSlug("")).toBeNull();
    expect(resolveProfileSlug("/index.html")).toBeNull();
  });

  it("rejects invalid slugs", () => {
    expect(resolveProfileSlug("/Bad_Slug")).toBeNull();
    expect(isValidProfileSlug("valid-slug-2")).toBe(true);
    expect(isValidProfileSlug("Bad")).toBe(false);
  });

  it("defines a default profile slug", () => {
    expect(DEFAULT_PROFILE_SLUG).toBe("default");
  });
});
