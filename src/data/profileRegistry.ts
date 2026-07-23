import type { Tweaks } from "./tweaksSchema";
import { loadProfileTweaks } from "./tweaksLoader";

export interface ProfileEntry {
  slug: string;
  name: string;
  description: string;
}

export const DEFAULT_PROFILE_SLUG = "default";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isValidProfileSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length > 0;
}

/** Pathname → profile slug, or null when at game root (no slug segment). */
export function resolveProfileSlug(pathname: string): string | null {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  if (segment === "" || segment === "index.html") return null;
  if (!isValidProfileSlug(segment)) return null;
  return segment;
}

export async function fetchProfileRegistry(): Promise<ProfileEntry[]> {
  const response = await fetch("/profiles/index.json");
  if (!response.ok) {
    throw new Error(`Failed to fetch profiles/index.json: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { profiles: ProfileEntry[] };
  return data.profiles;
}

export async function loadProfile(slug: string): Promise<Tweaks> {
  if (!isValidProfileSlug(slug)) {
    throw new Error(`Invalid profile slug: ${slug}`);
  }
  const tweaks = await loadProfileTweaks(slug);
  if (tweaks.meta.slug !== slug) {
    throw new Error(`Profile slug mismatch: URL/folder "${slug}" vs meta.slug "${tweaks.meta.slug}"`);
  }
  return tweaks;
}

export function profileEntryForSlug(registry: ProfileEntry[], slug: string): ProfileEntry | undefined {
  return registry.find((p) => p.slug === slug);
}
