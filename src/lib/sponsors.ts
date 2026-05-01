export interface Sponsor {
  name: string;
  url: string;
  avatarUrl?: string;
  tier: "gold" | "silver" | "bronze";
}

/**
 * Hardcoded sponsor data for now.
 * TODO: Switch to GitHub Sponsors API when ready.
 */
export const sponsors: Sponsor[] = [
  {
    name: "Your Company",
    url: "https://github.com/sponsors/exisz",
    tier: "gold",
  },
];
