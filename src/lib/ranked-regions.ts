export const RANKED_REGIONS = { "us-east": "US East", "us-west": "US West" } as const;
export type RankedRegion = keyof typeof RANKED_REGIONS;
export const DEFAULT_RANKED_REGION: RankedRegion = "us-east";
export const REGION_PREFERENCE_KEY = "alien-force-ranked-region";
export function isRankedRegion(value: unknown): value is RankedRegion {
  return value === "us-east" || value === "us-west";
}
