import { describe, it, expect } from "vitest";
import { HeavenlyScraper } from "../../src/lib/scrapers/heavenly.js";

describe("HeavenlyScraper", () => {
  const scraper = new HeavenlyScraper();

  it("has source set to 'heavenly'", () => {
    expect(scraper.source).toBe("heavenly");
  });

  it(
    "scrapes and returns valid structure with required fields",
    {
      timeout: 60_000,
    },
    async () => {
      const result = await scraper.scrape();

      expect(result.source).toBe("heavenly");
      expect(Array.isArray(result.listings)).toBe(true);

      // The shelter may have zero cats available at any given time,
      // so we validate structure on whatever is returned.
      for (const listing of result.listings) {
        expect(listing.source).toBe("heavenly");
        expect(listing.sourceId).toBeTruthy();
        expect(listing.name).toBeTruthy();
        expect(typeof listing.photoUrl).toBe("string");
        expect(typeof listing.age).toBe("string");
        expect(typeof listing.sex).toBe("string");
        expect(typeof listing.breed).toBe("string");
        expect(typeof listing.description).toBe("string");
        expect(listing.listingUrl).toContain("heavenlycreatures.ca");
      }
    },
  );
});
