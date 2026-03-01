import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDb,
  upsertListings,
  getActiveListings,
  deactivateMissing,
} from "../src/lib/db";
import type { NewCatListing } from "../src/lib/types";
import fs from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.join(import.meta.dirname, "test-kittens.db");

function makeListing(overrides: Partial<NewCatListing> = {}): NewCatListing {
  return {
    source: "test-shelter",
    sourceId: "cat-001",
    name: "Whiskers",
    photoUrl: "https://example.com/whiskers.jpg",
    age: "2 months",
    sex: "Male",
    breed: "Tabby",
    description: "A friendly kitten",
    listingUrl: "https://example.com/cats/001",
    ...overrides,
  };
}

describe("Database Layer", () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    // Remove test DB if it exists from a previous run
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = TEST_DB_PATH + suffix;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    db = createDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = TEST_DB_PATH + suffix;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  describe("createDb", () => {
    it("creates the listings table", () => {
      const row = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='listings'",
        )
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.name).toBe("listings");
    });

    it("enables WAL mode", () => {
      const row = db.prepare("PRAGMA journal_mode").get() as {
        journal_mode: string;
      };
      expect(row.journal_mode).toBe("wal");
    });
  });

  describe("upsertListings", () => {
    it("inserts a new listing and returns it as new", () => {
      const listing = makeListing();
      const { newListings } = upsertListings(db, [listing]);

      expect(newListings).toHaveLength(1);
      expect(newListings[0].name).toBe("Whiskers");
      expect(newListings[0].source).toBe("test-shelter");
      expect(newListings[0].sourceId).toBe("cat-001");
      expect(newListings[0].id).toBeDefined();
      expect(newListings[0].isActive).toBe(1);
      expect(newListings[0].firstSeen).toBeDefined();
      expect(newListings[0].lastSeen).toBeDefined();
    });

    it("does not create duplicates on upsert", () => {
      const listing = makeListing();
      const first = upsertListings(db, [listing]);
      expect(first.newListings).toHaveLength(1);

      // Upsert again with same source+sourceId
      const second = upsertListings(db, [listing]);
      expect(second.newListings).toHaveLength(0);

      // Verify only one row in the database
      const rows = db
        .prepare("SELECT COUNT(*) as count FROM listings")
        .get() as { count: number };
      expect(rows.count).toBe(1);
    });

    it("updates fields on duplicate upsert", () => {
      const listing = makeListing();
      upsertListings(db, [listing]);

      const updated = makeListing({ name: "Whiskers Jr.", age: "3 months" });
      upsertListings(db, [updated]);

      const rows = getActiveListings(db);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Whiskers Jr.");
      expect(rows[0].age).toBe("3 months");
    });

    it("handles multiple listings at once", () => {
      const listings = [
        makeListing({ sourceId: "cat-001", name: "Whiskers" }),
        makeListing({ sourceId: "cat-002", name: "Mittens" }),
        makeListing({ sourceId: "cat-003", name: "Shadow" }),
      ];

      const { newListings } = upsertListings(db, listings);
      expect(newListings).toHaveLength(3);
    });
  });

  describe("getActiveListings", () => {
    beforeEach(() => {
      const listings = [
        makeListing({
          source: "shelter-a",
          sourceId: "a1",
          name: "Luna",
          sex: "Female",
          age: "Kitten",
        }),
        makeListing({
          source: "shelter-a",
          sourceId: "a2",
          name: "Milo",
          sex: "Male",
          age: "Adult",
        }),
        makeListing({
          source: "shelter-b",
          sourceId: "b1",
          name: "Cleo",
          sex: "Female",
          age: "Senior",
        }),
      ];
      upsertListings(db, listings);
    });

    it("returns all active listings by default", () => {
      const listings = getActiveListings(db);
      expect(listings).toHaveLength(3);
    });

    it("filters by source", () => {
      const listings = getActiveListings(db, { source: "shelter-a" });
      expect(listings).toHaveLength(2);
      expect(listings.every((l) => l.source === "shelter-a")).toBe(true);
    });

    it("filters by sex", () => {
      const listings = getActiveListings(db, { sex: "Female" });
      expect(listings).toHaveLength(2);
      expect(listings.every((l) => l.sex === "Female")).toBe(true);
    });

    it("filters by age", () => {
      const listings = getActiveListings(db, { age: "Kitten" });
      expect(listings).toHaveLength(1);
      expect(listings[0].name).toBe("Luna");
    });

    it("combines multiple filters", () => {
      const listings = getActiveListings(db, {
        source: "shelter-a",
        sex: "Female",
      });
      expect(listings).toHaveLength(1);
      expect(listings[0].name).toBe("Luna");
    });

    it("returns results ordered by firstSeen DESC", () => {
      const listings = getActiveListings(db);
      for (let i = 1; i < listings.length; i++) {
        expect(listings[i - 1].firstSeen >= listings[i].firstSeen).toBe(true);
      }
    });
  });

  describe("deactivateMissing", () => {
    it("marks listings not in activeSourceIds as inactive", () => {
      const listings = [
        makeListing({ sourceId: "cat-001", name: "Whiskers" }),
        makeListing({ sourceId: "cat-002", name: "Mittens" }),
        makeListing({ sourceId: "cat-003", name: "Shadow" }),
      ];
      upsertListings(db, listings);

      // Only cat-001 is still active on the shelter's site
      deactivateMissing(db, "test-shelter", ["cat-001"]);

      const active = getActiveListings(db);
      expect(active).toHaveLength(1);
      expect(active[0].sourceId).toBe("cat-001");
    });

    it("only deactivates listings for the specified source", () => {
      const listings = [
        makeListing({ source: "shelter-a", sourceId: "a1", name: "Luna" }),
        makeListing({ source: "shelter-b", sourceId: "b1", name: "Cleo" }),
      ];
      upsertListings(db, listings);

      // Deactivate all from shelter-a (none in active list)
      deactivateMissing(db, "shelter-a", []);

      const active = getActiveListings(db);
      expect(active).toHaveLength(1);
      expect(active[0].source).toBe("shelter-b");
    });

    it("does nothing when all listings are still active", () => {
      const listings = [
        makeListing({ sourceId: "cat-001" }),
        makeListing({ sourceId: "cat-002" }),
      ];
      upsertListings(db, listings);

      deactivateMissing(db, "test-shelter", ["cat-001", "cat-002"]);

      const active = getActiveListings(db);
      expect(active).toHaveLength(2);
    });
  });
});
