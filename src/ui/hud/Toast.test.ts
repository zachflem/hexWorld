import { describe, expect, it } from "vitest";
import { softWrapToastText, TOAST_SOFT_WRAP_CHARS } from "./Toast";

describe("softWrapToastText", () => {
  it("leaves short strings alone", () => {
    expect(softWrapToastText("Short toast")).toBe("Short toast");
  });

  it("preserves existing newlines", () => {
    const text = "Line one that is already broken.\nLine two continues here.";
    expect(softWrapToastText(text)).toBe(text);
  });

  it("breaks long copy near the char budget on word boundaries", () => {
    const text =
      "We picked up a distant signal in the north — we should get the scouts to check it out.";
    const wrapped = softWrapToastText(text, TOAST_SOFT_WRAP_CHARS);
    const lines = wrapped.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) {
      expect(line.length).toBeLessThanOrEqual(TOAST_SOFT_WRAP_CHARS);
    }
    expect(wrapped.replace(/\n/g, " ")).toBe(text);
  });
});
