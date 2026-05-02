import { readFileSync } from "fs";
import { join } from "path";

export interface Sponsor {
  name: string;
  url: string;
  avatarUrl?: string;
  tier?: string;
  monthlyPriceInDollars?: number;
}

/**
 * Reads sponsors from data/sponsors.json (written by scripts/sync.ts).
 * Returns empty array if file missing or invalid.
 */
export function getSponsors(): Sponsor[] {
  try {
    const filePath = join(process.cwd(), "data", "sponsors.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

// Default export for backward compat with static imports
export const sponsors: Sponsor[] = getSponsors();
