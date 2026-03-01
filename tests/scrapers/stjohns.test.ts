import { describe, it, expect } from "vitest";
import { StJohnsScraper } from "../../src/lib/scrapers/stjohns.js";

describe("StJohnsScraper", () => {
  const scraper = new StJohnsScraper();

  it("has source set to 'stjohns'", () => {
    expect(scraper.source).toBe("stjohns");
  });

  it(
    "scrapes cat listings with required fields",
    {
      timeout: 60_000,
    },
    async () => {
      const result = await scraper.scrape();

      expect(result.source).toBe("stjohns");
      expect(Array.isArray(result.listings)).toBe(true);
      expect(result.listings.length).toBeGreaterThan(0);

      for (const listing of result.listings) {
        expect(listing.source).toBe("stjohns");
        expect(listing.sourceId).toBeTruthy();
        expect(listing.name).toBeTruthy();
        expect(listing.photoUrl).toBeTruthy();
        expect(listing.age).toBeTruthy();
        expect(listing.sex).toBeTruthy();
        expect(listing.breed).toBeTruthy();
        expect(typeof listing.description).toBe("string");
        expect(listing.listingUrl).toContain("petango.com");
        expect(listing.listingUrl).toContain(listing.sourceId);
      }
    },
  );
});
