export interface CatListing {
  id: string;
  source: string;
  sourceId: string;
  name: string;
  photoUrl: string;
  age: string;
  sex: string;
  breed: string;
  description: string;
  listingUrl: string;
  firstSeen: string;
  lastSeen: string;
  isActive: number;
}

export type NewCatListing = Omit<
  CatListing,
  "id" | "firstSeen" | "lastSeen" | "isActive"
>;

export type AgeCategory = "Kitten" | "Young" | "Adult" | "";

/**
 * Normalize a raw age string (e.g. "4 months", "3 years") into a UI category.
 *   Kitten: under 1 year
 *   Young:  1–3 years
 *   Adult:  4+ years
 */
export function normalizeAge(raw: string): AgeCategory {
  if (!raw) return "";

  const lower = raw.toLowerCase().trim();

  // Direct keyword matches
  if (lower === "kitten") return "Kitten";
  if (lower === "senior") return "Adult";
  if (lower === "young") return "Young";
  if (lower === "adult") return "Adult";

  // Try to parse numeric age
  const yearsMatch = lower.match(/(\d+)\s*(?:year|yr)s?/);
  const monthsMatch = lower.match(/(\d+)\s*(?:month|mo)s?/);
  const weeksMatch = lower.match(/(\d+)\s*(?:week|wk)s?/);

  let totalMonths = 0;
  if (yearsMatch) totalMonths += parseInt(yearsMatch[1], 10) * 12;
  if (monthsMatch) totalMonths += parseInt(monthsMatch[1], 10);
  if (weeksMatch) totalMonths += Math.ceil(parseInt(weeksMatch[1], 10) / 4);

  if (totalMonths === 0 && !yearsMatch && !monthsMatch && !weeksMatch) {
    return "";
  }

  if (totalMonths < 12) return "Kitten";
  if (totalMonths < 48) return "Young";
  return "Adult";
}
