import { describe, it, expect } from "vitest";
import { SpcaScraper } from "../../src/lib/scrapers/spca.js";

describe("SpcaScraper", () => {
  const scraper = new SpcaScraper();

  it("has source set to 'spca'", () => {
    expect(scraper.source).toBe("spca");
  });

  it(
    "scrapes cat listings with required fields",
    {
      timeout: 60_000,
    },
    async () => {
      const result = await scraper.scrape();

      expect(result.source).toBe("spca");
      expect(Array.isArray(result.listings)).toBe(true);
      expect(result.listings.length).toBeGreaterThan(0);

      for (const listing of result.listings) {
        expect(listing.source).toBe("spca");
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
