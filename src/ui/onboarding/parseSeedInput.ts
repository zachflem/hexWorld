export type ParseSeedResult =
  | { ok: true; seed?: number }
  | { ok: false; error: string };

/** Same rules as the original onboarding form: blank is fine; otherwise a non-negative integer. */
export function parseSeedInput(input: string): ParseSeedResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: true };
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: "Seed must be a whole number" };
  }
  return { ok: true, seed: parsed };
}
