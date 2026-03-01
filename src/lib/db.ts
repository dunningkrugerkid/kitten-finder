import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { CatListing, NewCatListing } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  name TEXT NOT NULL,
  photoUrl TEXT NOT NULL DEFAULT '',
  age TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT 'Unknown',
  breed TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  listingUrl TEXT NOT NULL,
  firstSeen TEXT NOT NULL,
  lastSeen TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  UNIQUE(source, sourceId)
)`;

export function createDb(path = "kitten-finder.db"): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function upsertListings(
  db: Database.Database,
  listings: NewCatListing[],
): { newListings: CatListing[] } {
  const now = new Date().toISOString();
  const newListings: CatListing[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO listings (id, source, sourceId, name, photoUrl, age, sex, breed, description, listingUrl, firstSeen, lastSeen, isActive)
    VALUES (@id, @source, @sourceId, @name, @photoUrl, @age, @sex, @breed, @description, @listingUrl, @firstSeen, @lastSeen, 1)
    ON CONFLICT(source, sourceId) DO UPDATE SET
      name = excluded.name,
      photoUrl = excluded.photoUrl,
      age = excluded.age,
      sex = excluded.sex,
      breed = excluded.breed,
      description = excluded.description,
      listingUrl = excluded.listingUrl,
      lastSeen = excluded.lastSeen,
      isActive = 1
  `);

  const checkStmt = db.prepare(
    "SELECT id FROM listings WHERE source = ? AND sourceId = ?",
  );

  const getStmt = db.prepare("SELECT * FROM listings WHERE id = ?");

  const upsertAll = db.transaction((items: NewCatListing[]) => {
    for (const listing of items) {
      const existing = checkStmt.get(listing.source, listing.sourceId) as
        | { id: string }
        | undefined;

      const id = existing?.id ?? randomUUID();

      insertStmt.run({
        id,
        source: listing.source,
        sourceId: listing.sourceId,
        name: listing.name,
        photoUrl: listing.photoUrl,
        age: listing.age,
        sex: listing.sex,
        breed: listing.breed,
        description: listing.description,
        listingUrl: listing.listingUrl,
        firstSeen: now,
        lastSeen: now,
      });

      if (!existing) {
        const row = getStmt.get(id) as CatListing;
        newListings.push(row);
      }
    }
  });

  upsertAll(listings);

  return { newListings };
}

export interface ListingFilters {
  source?: string;
  sex?: string;
  age?: string;
}

export function getActiveListings(
  db: Database.Database,
  filters?: ListingFilters,
): CatListing[] {
  const conditions: string[] = ["isActive = 1"];
  const params: Record<string, string> = {};

  if (filters?.source) {
    conditions.push("source = @source");
    params.source = filters.source;
  }
  if (filters?.sex) {
    conditions.push("sex = @sex");
    params.sex = filters.sex;
  }
  if (filters?.age) {
    conditions.push("age = @age");
    params.age = filters.age;
  }

  const sql = `SELECT * FROM listings WHERE ${conditions.join(" AND ")} ORDER BY firstSeen DESC`;
  return db.prepare(sql).all(params) as CatListing[];
}

export function deactivateMissing(
  db: Database.Database,
  source: string,
  activeSourceIds: string[],
): void {
  if (activeSourceIds.length === 0) {
    db.prepare(
      "UPDATE listings SET isActive = 0 WHERE source = ? AND isActive = 1",
    ).run(source);
    return;
  }

  const placeholders = activeSourceIds.map(() => "?").join(", ");
  db.prepare(
    `UPDATE listings SET isActive = 0 WHERE source = ? AND isActive = 1 AND sourceId NOT IN (${placeholders})`,
  ).run(source, ...activeSourceIds);
}
