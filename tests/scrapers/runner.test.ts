import { describe, it, expect, vi } from "vitest";
import { runAllScrapers } from "../../src/lib/scrapers/runner.js";
import type { Scraper, ScraperResult } from "../../src/lib/scrapers/types.js";
import type { NewCatListing } from "../../src/lib/types.js";

function makeListing(overrides: Partial<NewCatListing> = {}): NewCatListing {
  return {
    source: "test-source",
    sourceId: "123",
    name: "Whiskers",
    photoUrl: "https://example.com/whiskers.jpg",
    age: "2 months",
    sex: "Female",
    breed: "Tabby",
    description: "A playful kitten",
    listingUrl: "https://example.com/whiskers",
    ...overrides,
  };
}

function makeScraper(source: string, listings: NewCatListing[]): Scraper {
  return {
    source,
    async scrape(): Promise<ScraperResult> {
      return { listings, source };
    },
  };
}

function makeFailingScraper(source: string): Scraper {
  return {
    source,
    async scrape(): Promise<ScraperResult> {
      throw new Error(`${source} broke`);
    },
  };
}

describe("runAllScrapers", () => {
  it("collects results from multiple scrapers", async () => {
    const listingA = makeListing({
      name: "Luna",
      source: "source-a",
      sourceId: "a1",
    });
    const listingB = makeListing({
      name: "Milo",
      source: "source-b",
      sourceId: "b1",
    });

    const scrapers: Scraper[] = [
      makeScraper("source-a", [listingA]),
      makeScraper("source-b", [listingB]),
    ];

    const results = await runAllScrapers(scrapers);

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe("source-a");
    expect(results[0].listings).toEqual([listingA]);
    expect(results[1].source).toBe("source-b");
    expect(results[1].listings).toEqual([listingB]);
  });

  it("continues if one scraper fails, returning only successful results", async () => {
    const listing = makeListing({
      name: "Felix",
      source: "good-source",
      sourceId: "g1",
    });

    const scrapers: Scraper[] = [
      makeScraper("good-source", [listing]),
      makeFailingScraper("bad-source"),
      makeScraper("another-good", []),
    ];

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await runAllScrapers(scrapers);

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe("good-source");
    expect(results[0].listings).toEqual([listing]);
    expect(results[1].source).toBe("another-good");
    expect(results[1].listings).toEqual([]);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[bad-source] Scraper failed:",
      "bad-source broke",
    );

    consoleSpy.mockRestore();
  });
});
