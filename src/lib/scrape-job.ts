import type Database from "better-sqlite3";
import { upsertListings, deactivateMissing } from "./db.js";
import { runAllScrapers } from "./scrapers/runner.js";
import { sendKittenAlerts } from "./discord.js";
import { SpcaScraper } from "./scrapers/spca.js";
import { HeavenlyScraper } from "./scrapers/heavenly.js";
import { StJohnsScraper } from "./scrapers/stjohns.js";
import type { CatListing } from "./types.js";

const scrapers = [
  new SpcaScraper(),
  new HeavenlyScraper(),
  new StJohnsScraper(),
];

export async function runScrapeJob(
  db: Database.Database,
  discordToken?: string,
  discordUserId?: string,
): Promise<{ newCount: number }> {
  console.log(`[${new Date().toISOString()}] Starting scrape job...`);

  const results = await runAllScrapers(scrapers);
  const allNewListings: CatListing[] = [];

  for (const result of results) {
    const { newListings } = upsertListings(db, result.listings);
    allNewListings.push(...newListings);

    const activeIds = result.listings.map((l) => l.sourceId);
    deactivateMissing(db, result.source, activeIds);
  }

  console.log(
    `Scrape complete. ${allNewListings.length} new listing(s) found.`,
  );

  if (allNewListings.length > 0 && discordToken && discordUserId) {
    try {
      await sendKittenAlerts(allNewListings, discordToken, discordUserId);
    } catch (err) {
      console.error(
        "Failed to send Discord alerts:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { newCount: allNewListings.length };
}
