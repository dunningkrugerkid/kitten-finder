import type { NewCatListing } from "../types.js";

export interface ScraperResult {
  listings: NewCatListing[];
  source: string;
}

export interface Scraper {
  readonly source: string;
  scrape(): Promise<ScraperResult>;
}
