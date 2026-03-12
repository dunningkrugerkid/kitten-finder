//
// TEMPLATE: Copy this file and rename it for your custom shelter scraper.
//
// 1. Implement the scrape() method to return listings from your shelter's website
// 2. Add a "custom" entry to shelters.config.ts pointing to this file
// 3. That's it! The scraper will run automatically on the configured schedule.
//
// See heavenly.ts for a real-world example of a custom scraper.

import { chromium } from "playwright";
import type { NewCatListing } from "../types.js";
import type { Scraper, ScraperResult } from "./types.js";

const SHELTER_URL = "https://your-shelter-website.com/adoptable-cats";

export default class MyShelterScraper implements Scraper {
  readonly source = "my-shelter"; // must match the "key" in shelters.config.ts

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(SHELTER_URL, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      // TODO: Extract cat listings from the page DOM
      // Use page.$$eval() to query elements and extract data
      // Return an array of NewCatListing objects

      const listings: NewCatListing[] = [];

      return { listings, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
