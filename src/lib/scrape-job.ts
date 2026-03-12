import type Database from "better-sqlite3";
import { upsertListings, deactivateMissing } from "./db.js";
import { runAllScrapers } from "./scrapers/runner.js";
import type { Scraper } from "./scrapers/types.js";
import type { Notifier } from "./notifiers/types.js";
import type { CatListing } from "./types.js";

export async function runScrapeJob(
  db: Database.Database,
  scrapers: Scraper[],
  notifiers: Notifier[],
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

  if (allNewListings.length > 0) {
    for (const notifier of notifiers) {
      try {
        await notifier.notify(allNewListings);
      } catch (err) {
        console.error(
          `[${notifier.name}] Failed to send alerts:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { newCount: allNewListings.length };
}
