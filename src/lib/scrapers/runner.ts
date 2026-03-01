import type { Scraper, ScraperResult } from "./types.js";

export async function runAllScrapers(
  scrapers: Scraper[],
): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  for (const scraper of scrapers) {
    try {
      const result = await scraper.scrape();
      results.push(result);
      console.log(
        `[${scraper.source}] Scraped ${result.listings.length} listings`,
      );
    } catch (err) {
      console.error(
        `[${scraper.source}] Scraper failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return results;
}
