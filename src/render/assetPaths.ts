export type AssetCategory = "terrain" | "resources" | "structures" | "units" | "markers";

export const DEFAULT_PROFILE_SLUG = "default";

let profileSlug = DEFAULT_PROFILE_SLUG;

export function initAssetConfig(slug: string): void {
  profileSlug = slug;
}

export function resetAssetConfig(): void {
  profileSlug = DEFAULT_PROFILE_SLUG;
}

function profileAssetUrl(slug: string, category: AssetCategory, filename: string): string {
  return `/profiles/${slug}/assets/${category}/${filename}`;
}

/** Ordered URLs to try for a sprite — active profile, then default profile pack. */
export function assetUrlCandidates(category: AssetCategory, filename: string): string[] {
  const urls = [profileAssetUrl(profileSlug, category, filename)];
  if (profileSlug !== DEFAULT_PROFILE_SLUG) {
    urls.push(profileAssetUrl(DEFAULT_PROFILE_SLUG, category, filename));
  }
  return urls;
}

/** Primary URL — first candidate in the fallback chain. */
export function resolveAssetPath(category: AssetCategory, filename: string): string {
  return assetUrlCandidates(category, filename)[0]!;
}
