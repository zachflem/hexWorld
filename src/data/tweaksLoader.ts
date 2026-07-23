import stripJsonComments from "strip-json-comments";
import { tweaksSchema, type Tweaks } from "./tweaksSchema";
import { DEFAULT_PROFILE_SLUG } from "./profileRegistry";

function parseTweaksJsonc(raw: string, sourceLabel: string): Tweaks {
  const stripped = stripJsonComments(raw);
  const parsed = JSON.parse(stripped);
  const result = tweaksSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${sourceLabel} failed validation: ${result.error.message}`);
  }
  return result.data;
}

export async function loadProfileTweaks(slug: string): Promise<Tweaks> {
  const response = await fetch(`/profiles/${slug}/tweaks.jsonc`);
  if (!response.ok) {
    throw new Error(`Failed to fetch profiles/${slug}/tweaks.jsonc: ${response.status} ${response.statusText}`);
  }
  const raw = await response.text();
  return parseTweaksJsonc(raw, `profiles/${slug}/tweaks.jsonc`);
}

/** @deprecated Use loadProfile from profileRegistry — kept for tests importing default tweaks. */
export async function loadTweaks(): Promise<Tweaks> {
  return loadProfileTweaks(DEFAULT_PROFILE_SLUG);
}
