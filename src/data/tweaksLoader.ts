import stripJsonComments from "strip-json-comments";
import { tweaksSchema, type Tweaks } from "./tweaksSchema";

export async function loadTweaks(): Promise<Tweaks> {
  const response = await fetch("/tweaks.jsonc");
  if (!response.ok) {
    throw new Error(`Failed to fetch tweaks.jsonc: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  const stripped = stripJsonComments(raw);
  const parsed = JSON.parse(stripped);

  const result = tweaksSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`tweaks.jsonc failed validation: ${result.error.message}`);
  }

  return result.data;
}
