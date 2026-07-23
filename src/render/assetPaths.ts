import type { Tweaks } from "../data/tweaksSchema";

export type AssetCategory = "terrain" | "resources" | "structures" | "units" | "markers";

const DEFAULT_PROFILE_SLUG = "default";

let profileSlug = DEFAULT_PROFILE_SLUG;
let customSprites = false;

export function initAssetConfig(slug: string, assets: Tweaks["assets"] | undefined): void {
  profileSlug = slug;
  customSprites = assets?.custom_sprites === true;
}

export function resetAssetConfig(): void {
  profileSlug = DEFAULT_PROFILE_SLUG;
  customSprites = false;
}

/** Ordered URLs to try for a sprite — profile override, then shared default pack. */
export function assetUrlCandidates(category: AssetCategory, filename: string): string[] {
  const defaultUrl = `/tiles/${category}/${filename}`;
  if (!customSprites) return [defaultUrl];
  return [`/profiles/${profileSlug}/assets/${category}/${filename}`, defaultUrl];
}

/** Primary URL — first candidate in the fallback chain. */
export function resolveAssetPath(category: AssetCategory, filename: string): string {
  return assetUrlCandidates(category, filename)[0]!;
}
