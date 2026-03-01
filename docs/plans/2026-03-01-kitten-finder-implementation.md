# Kitten Finder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a kitten adoption scraper and dashboard that aggregates listings from 4 St. John's NL sources, stores them in SQLite, serves a filterable dashboard, and sends Discord DM alerts for new listings.

**Architecture:** Node.js/TypeScript backend with Playwright for scraping JS-heavy sites, SQLite for storage, Express for serving a static dashboard, node-cron for scheduling, and discord.js for DM alerts. Hybrid scraping: try WordPress REST API or direct HTTP first, fall back to Playwright.

**Tech Stack:** TypeScript, Node.js, Playwright, better-sqlite3, Express, node-cron, discord.js, Vitest

---

### Task 1: Project Scaffolding

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Initialize project and install dependencies**

Run:

```bash
cd /Users/amelie/kitten-finder
npm init -y
npm install typescript @types/node tsx --save-dev
npm install express @types/express better-sqlite3 @types/better-sqlite3 node-cron @types/node-cron discord.js playwright dotenv uuid
npm install vitest --save-dev
npx playwright install chromium
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .env.example**

```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_USER_ID=your_user_id_here
SCRAPE_INTERVAL_HOURS=4
PORT=3000
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.db
```

**Step 5: Create placeholder entry point**

Create `src/index.ts`:

```typescript
console.log("Kitten Finder starting...");
```

**Step 6: Add scripts to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 7: Verify setup**

Run: `cd /Users/amelie/kitten-finder && npm run dev`
Expected: `Kitten Finder starting...`

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with dependencies"
```

---

### Task 2: Database Layer

**Files:**

- Create: `src/db.ts`
- Create: `src/types.ts`
- Create: `tests/db.test.ts`

**Step 1: Write types**

Create `src/types.ts`:

```typescript
export interface CatListing {
  id: string;
  source: string;
  sourceId: string;
  name: string;
  photoUrl: string;
  age: string;
  sex: string;
  breed: string;
  description: string;
  listingUrl: string;
  firstSeen: string;
  lastSeen: string;
  isActive: number;
}

export type NewCatListing = Omit<
  CatListing,
  "id" | "firstSeen" | "lastSeen" | "isActive"
>;
```

**Step 2: Write failing tests**

Create `tests/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDb,
  upsertListings,
  getActiveListings,
  deactivateMissing,
} from "../src/db.js";
import Database from "better-sqlite3";
import { unlinkSync } from "fs";
import type { NewCatListing } from "../src/types.js";

const TEST_DB = "test-kittens.db";

function makeTestListing(
  overrides: Partial<NewCatListing> = {},
): NewCatListing {
  return {
    source: "spca",
    sourceId: "cat-123",
    name: "Mittens",
    photoUrl: "https://example.com/mittens.jpg",
    age: "kitten",
    sex: "Female",
    breed: "Domestic Shorthair",
    description: "A sweet little kitten",
    listingUrl: "https://example.com/mittens",
    ...overrides,
  };
}

describe("database", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(TEST_DB);
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(TEST_DB);
    } catch {}
  });

  it("creates the listings table", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='listings'",
      )
      .get();
    expect(tables).toBeTruthy();
  });

  it("inserts a new listing and returns it as new", () => {
    const listing = makeTestListing();
    const result = upsertListings(db, [listing]);
    expect(result.newListings).toHaveLength(1);
    expect(result.newListings[0].name).toBe("Mittens");
    expect(result.newListings[0].isActive).toBe(1);
  });

  it("updates lastSeen on duplicate instead of inserting", () => {
    const listing = makeTestListing();
    upsertListings(db, [listing]);
    const result = upsertListings(db, [listing]);
    expect(result.newListings).toHaveLength(0);

    const all = getActiveListings(db);
    expect(all).toHaveLength(1);
  });

  it("retrieves active listings with filters", () => {
    upsertListings(db, [
      makeTestListing({
        sourceId: "cat-1",
        name: "Mittens",
        sex: "Female",
        source: "spca",
      }),
      makeTestListing({
        sourceId: "cat-2",
        name: "Boots",
        sex: "Male",
        source: "heavenly",
      }),
    ]);

    const females = getActiveListings(db, { sex: "Female" });
    expect(females).toHaveLength(1);
    expect(females[0].name).toBe("Mittens");

    const fromSpca = getActiveListings(db, { source: "spca" });
    expect(fromSpca).toHaveLength(1);
  });

  it("deactivates listings not in the current scrape", () => {
    upsertListings(db, [
      makeTestListing({ sourceId: "cat-1", name: "Mittens" }),
      makeTestListing({ sourceId: "cat-2", name: "Boots" }),
    ]);

    deactivateMissing(db, "spca", ["cat-1"]);

    const active = getActiveListings(db);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("Mittens");
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/db.test.ts`
Expected: FAIL — module `../src/db.js` not found

**Step 4: Implement the database layer**

Create `src/db.ts`:

```typescript
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { CatListing, NewCatListing } from "./types.js";

export function createDb(path = "kittens.db"): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");

  db.exec(`
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
    )
  `);

  return db;
}

interface UpsertResult {
  newListings: CatListing[];
}

export function upsertListings(
  db: Database.Database,
  listings: NewCatListing[],
): UpsertResult {
  const now = new Date().toISOString();
  const newListings: CatListing[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO listings (id, source, sourceId, name, photoUrl, age, sex, breed, description, listingUrl, firstSeen, lastSeen, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const updateStmt = db.prepare(`
    UPDATE listings SET lastSeen = ?, isActive = 1, name = ?, photoUrl = ?, age = ?, sex = ?, breed = ?, description = ?
    WHERE source = ? AND sourceId = ?
  `);

  const existsStmt = db.prepare(`
    SELECT id FROM listings WHERE source = ? AND sourceId = ?
  `);

  const getStmt = db.prepare(`SELECT * FROM listings WHERE id = ?`);

  const transaction = db.transaction(() => {
    for (const listing of listings) {
      const existing = existsStmt.get(listing.source, listing.sourceId) as
        | { id: string }
        | undefined;

      if (existing) {
        updateStmt.run(
          now,
          listing.name,
          listing.photoUrl,
          listing.age,
          listing.sex,
          listing.breed,
          listing.description,
          listing.source,
          listing.sourceId,
        );
      } else {
        const id = randomUUID();
        insertStmt.run(
          id,
          listing.source,
          listing.sourceId,
          listing.name,
          listing.photoUrl,
          listing.age,
          listing.sex,
          listing.breed,
          listing.description,
          listing.listingUrl,
          now,
          now,
        );
        const row = getStmt.get(id) as CatListing;
        newListings.push(row);
      }
    }
  });

  transaction();
  return { newListings };
}

interface ListingFilters {
  source?: string;
  sex?: string;
  age?: string;
}

export function getActiveListings(
  db: Database.Database,
  filters: ListingFilters = {},
): CatListing[] {
  let query = "SELECT * FROM listings WHERE isActive = 1";
  const params: string[] = [];

  if (filters.source) {
    query += " AND source = ?";
    params.push(filters.source);
  }
  if (filters.sex) {
    query += " AND sex = ?";
    params.push(filters.sex);
  }
  if (filters.age) {
    query += " AND age = ?";
    params.push(filters.age);
  }

  query += " ORDER BY firstSeen DESC";
  return db.prepare(query).all(...params) as CatListing[];
}

export function deactivateMissing(
  db: Database.Database,
  source: string,
  activeSourceIds: string[],
): void {
  if (activeSourceIds.length === 0) {
    db.prepare("UPDATE listings SET isActive = 0 WHERE source = ?").run(source);
    return;
  }

  const placeholders = activeSourceIds.map(() => "?").join(",");
  db.prepare(
    `UPDATE listings SET isActive = 0 WHERE source = ? AND sourceId NOT IN (${placeholders})`,
  ).run(source, ...activeSourceIds);
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/db.test.ts`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add src/types.ts src/db.ts tests/db.test.ts
git commit -m "feat: database layer with SQLite schema, upsert, filters, and deactivation"
```

---

### Task 3: Scraper Infrastructure

**Files:**

- Create: `src/scrapers/types.ts`
- Create: `src/scrapers/base.ts`
- Create: `tests/scrapers/base.test.ts`

**Step 1: Write scraper interface and types**

Create `src/scrapers/types.ts`:

```typescript
import type { NewCatListing } from "../types.js";

export interface ScraperResult {
  listings: NewCatListing[];
  source: string;
}

export interface Scraper {
  readonly source: string;
  scrape(): Promise<ScraperResult>;
}
```

**Step 2: Write failing test for scraper runner**

Create `tests/scrapers/base.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { runAllScrapers } from "../../src/scrapers/base.js";
import type { Scraper, ScraperResult } from "../../src/scrapers/types.js";

function makeMockScraper(
  source: string,
  listings: ScraperResult["listings"],
): Scraper {
  return {
    source,
    async scrape() {
      return { listings, source };
    },
  };
}

function makeFailingScraper(source: string): Scraper {
  return {
    source,
    async scrape() {
      throw new Error(`${source} failed`);
    },
  };
}

describe("runAllScrapers", () => {
  it("collects results from multiple scrapers", async () => {
    const scrapers = [
      makeMockScraper("spca", [
        {
          source: "spca",
          sourceId: "1",
          name: "Mittens",
          photoUrl: "",
          age: "kitten",
          sex: "Female",
          breed: "",
          description: "",
          listingUrl: "https://example.com",
        },
      ]),
      makeMockScraper("heavenly", [
        {
          source: "heavenly",
          sourceId: "2",
          name: "Boots",
          photoUrl: "",
          age: "young",
          sex: "Male",
          breed: "",
          description: "",
          listingUrl: "https://example.com",
        },
      ]),
    ];

    const results = await runAllScrapers(scrapers);
    expect(results).toHaveLength(2);
    expect(results[0].listings).toHaveLength(1);
    expect(results[1].listings).toHaveLength(1);
  });

  it("continues if one scraper fails, returning only successful results", async () => {
    const scrapers = [
      makeFailingScraper("broken"),
      makeMockScraper("spca", [
        {
          source: "spca",
          sourceId: "1",
          name: "Mittens",
          photoUrl: "",
          age: "kitten",
          sex: "Female",
          breed: "",
          description: "",
          listingUrl: "https://example.com",
        },
      ]),
    ];

    const results = await runAllScrapers(scrapers);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("spca");
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/base.test.ts`
Expected: FAIL — cannot find `../../src/scrapers/base.js`

**Step 4: Implement scraper runner**

Create `src/scrapers/base.ts`:

```typescript
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
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/base.test.ts`
Expected: All 2 tests PASS

**Step 6: Commit**

```bash
git add src/scrapers/types.ts src/scrapers/base.ts tests/scrapers/base.test.ts
git commit -m "feat: scraper infrastructure with runner and error isolation"
```

---

### Task 4: SPCA St. John's Scraper

**Files:**

- Create: `src/scrapers/spca.ts`
- Create: `tests/scrapers/spca.test.ts`

**Context:** https://spcastjohns.org/adopt/cat/ is a WordPress site. We'll first check the WP REST API, then fall back to Playwright.

**Step 1: Explore the SPCA site's WordPress REST API**

Run: `curl -s "https://spcastjohns.org/wp-json/wp/v2/posts?per_page=5" | head -c 2000`

This will reveal if there's a usable REST API. Also try:
Run: `curl -s "https://spcastjohns.org/wp-json/" | head -c 2000`

If the API doesn't expose pet data, we'll use Playwright.

**Step 2: Write failing test**

Create `tests/scrapers/spca.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SpcaScraper } from "../../src/scrapers/spca.js";

describe("SpcaScraper", () => {
  it("has correct source name", () => {
    const scraper = new SpcaScraper();
    expect(scraper.source).toBe("spca");
  });

  it("returns listings with required fields", async () => {
    const scraper = new SpcaScraper();
    const result = await scraper.scrape();

    expect(result.source).toBe("spca");
    expect(Array.isArray(result.listings)).toBe(true);

    // Site may have 0 listings, but structure should be valid
    for (const listing of result.listings) {
      expect(listing.source).toBe("spca");
      expect(listing.sourceId).toBeTruthy();
      expect(listing.name).toBeTruthy();
      expect(listing.listingUrl).toBeTruthy();
    }
  }, 60000); // 60s timeout for Playwright
});
```

**Step 3: Run test to verify it fails**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/spca.test.ts`
Expected: FAIL — cannot find `../../src/scrapers/spca.js`

**Step 4: Implement SPCA scraper**

Create `src/scrapers/spca.ts`:

```typescript
import { chromium } from "playwright";
import type { Scraper, ScraperResult } from "./types.js";
import type { NewCatListing } from "../types.js";

export class SpcaScraper implements Scraper {
  readonly source = "spca";
  private url = "https://spcastjohns.org/adopt/cat/";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for listing content to render
      await page.waitForTimeout(3000);

      const listings = await page.evaluate(() => {
        const cards: Array<{
          name: string;
          photoUrl: string;
          age: string;
          sex: string;
          breed: string;
          description: string;
          listingUrl: string;
          sourceId: string;
        }> = [];

        // SPCA sites typically use article elements, cards, or grid items for each animal
        // Selectors will need to be refined after inspecting the live page
        const elements = document.querySelectorAll(
          "article, .pet-card, .animal-card, .type-pets, .et_pb_post, [class*='pet'], [class*='cat'], [class*='animal']",
        );

        elements.forEach((el) => {
          const linkEl = el.querySelector("a[href]");
          const imgEl = el.querySelector("img");
          const titleEl = el.querySelector(
            "h2, h3, h4, .entry-title, .pet-name",
          );

          const name = titleEl?.textContent?.trim() || "";
          const listingUrl = linkEl?.getAttribute("href") || "";
          const photoUrl =
            imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

          // Extract metadata from text content
          const text = el.textContent || "";
          const ageMatch = text.match(/age[:\s]*([\w\s]+?)(?:\n|,|$)/i);
          const sexMatch = text.match(/(male|female)/i);
          const breedMatch = text.match(/breed[:\s]*([\w\s]+?)(?:\n|,|$)/i);

          if (name && listingUrl) {
            cards.push({
              name,
              photoUrl,
              age: ageMatch?.[1]?.trim() || "",
              sex: sexMatch?.[1] || "Unknown",
              breed: breedMatch?.[1]?.trim() || "",
              description: text.substring(0, 500).trim(),
              listingUrl,
              sourceId: listingUrl,
            });
          }
        });

        return cards;
      });

      const result: NewCatListing[] = listings.map((l) => ({
        source: this.source,
        sourceId: l.sourceId,
        name: l.name,
        photoUrl: l.photoUrl,
        age: l.age,
        sex: l.sex,
        breed: l.breed,
        description: l.description,
        listingUrl: l.listingUrl,
      }));

      return { listings: result, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
```

> **Note:** The CSS selectors above are best-effort guesses. During implementation, you MUST open the actual page in a browser, inspect the DOM, and update the selectors to match the real structure. Use `page.content()` to dump the rendered HTML if needed.

**Step 5: Run test**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/spca.test.ts`
Expected: PASS (structure valid, even if 0 listings due to selector mismatch — refine selectors in next step if needed)

**Step 6: Debug selectors if needed**

If the scraper returns 0 listings, add a temporary debug step:

```typescript
const html = await page.content();
require("fs").writeFileSync("/tmp/spca-debug.html", html);
```

Open `/tmp/spca-debug.html` in a browser and inspect the DOM to find correct selectors. Update the `page.evaluate` accordingly.

**Step 7: Commit**

```bash
git add src/scrapers/spca.ts tests/scrapers/spca.test.ts
git commit -m "feat: SPCA St. John's scraper with Playwright"
```

---

### Task 5: Heavenly Creatures Scraper

**Files:**

- Create: `src/scrapers/heavenly.ts`
- Create: `tests/scrapers/heavenly.test.ts`

**Context:** https://heavenlycreatures.ca/adoptions/available-cats/ — WordPress site, similar approach to SPCA.

**Step 1: Write failing test**

Create `tests/scrapers/heavenly.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { HeavenlyScraper } from "../../src/scrapers/heavenly.js";

describe("HeavenlyScraper", () => {
  it("has correct source name", () => {
    const scraper = new HeavenlyScraper();
    expect(scraper.source).toBe("heavenly");
  });

  it("returns listings with required fields", async () => {
    const scraper = new HeavenlyScraper();
    const result = await scraper.scrape();

    expect(result.source).toBe("heavenly");
    expect(Array.isArray(result.listings)).toBe(true);

    for (const listing of result.listings) {
      expect(listing.source).toBe("heavenly");
      expect(listing.sourceId).toBeTruthy();
      expect(listing.name).toBeTruthy();
      expect(listing.listingUrl).toBeTruthy();
    }
  }, 60000);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/heavenly.test.ts`
Expected: FAIL

**Step 3: Implement Heavenly Creatures scraper**

Create `src/scrapers/heavenly.ts`:

```typescript
import { chromium } from "playwright";
import type { Scraper, ScraperResult } from "./types.js";
import type { NewCatListing } from "../types.js";

export class HeavenlyScraper implements Scraper {
  readonly source = "heavenly";
  private url = "https://heavenlycreatures.ca/adoptions/available-cats/";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      const listings = await page.evaluate(() => {
        const cards: Array<{
          name: string;
          photoUrl: string;
          age: string;
          sex: string;
          breed: string;
          description: string;
          listingUrl: string;
          sourceId: string;
        }> = [];

        // Heavenly Creatures likely uses WordPress posts or a gallery plugin
        const elements = document.querySelectorAll(
          "article, .pet-card, .et_pb_post, .entry, [class*='pet'], [class*='cat'], [class*='animal'], .wp-block-post",
        );

        elements.forEach((el) => {
          const linkEl = el.querySelector("a[href]");
          const imgEl = el.querySelector("img");
          const titleEl = el.querySelector(
            "h2, h3, h4, .entry-title, .pet-name",
          );

          const name = titleEl?.textContent?.trim() || "";
          const listingUrl = linkEl?.getAttribute("href") || "";
          const photoUrl =
            imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

          const text = el.textContent || "";
          const ageMatch = text.match(/age[:\s]*([\w\s]+?)(?:\n|,|$)/i);
          const sexMatch = text.match(/(male|female)/i);
          const breedMatch = text.match(/breed[:\s]*([\w\s]+?)(?:\n|,|$)/i);

          if (name && listingUrl) {
            cards.push({
              name,
              photoUrl,
              age: ageMatch?.[1]?.trim() || "",
              sex: sexMatch?.[1] || "Unknown",
              breed: breedMatch?.[1]?.trim() || "",
              description: text.substring(0, 500).trim(),
              listingUrl,
              sourceId: listingUrl,
            });
          }
        });

        return cards;
      });

      const result: NewCatListing[] = listings.map((l) => ({
        source: this.source,
        sourceId: l.sourceId,
        name: l.name,
        photoUrl: l.photoUrl,
        age: l.age,
        sex: l.sex,
        breed: l.breed,
        description: l.description,
        listingUrl: l.listingUrl,
      }));

      return { listings: result, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
```

> **Same note as SPCA:** Selectors are best-effort. Inspect the live DOM and refine during implementation.

**Step 4: Run test**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/heavenly.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/scrapers/heavenly.ts tests/scrapers/heavenly.test.ts
git commit -m "feat: Heavenly Creatures scraper with Playwright"
```

---

### Task 6: City of St. John's (PetPoint) Scraper

**Files:**

- Create: `src/scrapers/stjohns.ts`
- Create: `tests/scrapers/stjohns.test.ts`

**Context:** https://apps.stjohns.ca/petpoint/Adoptablepets.aspx uses a JS tab system. We must click the "Cats" tab and extract data.

**Step 1: Write failing test**

Create `tests/scrapers/stjohns.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { StJohnsScraper } from "../../src/scrapers/stjohns.js";

describe("StJohnsScraper", () => {
  it("has correct source name", () => {
    const scraper = new StJohnsScraper();
    expect(scraper.source).toBe("stjohns");
  });

  it("returns listings with required fields", async () => {
    const scraper = new StJohnsScraper();
    const result = await scraper.scrape();

    expect(result.source).toBe("stjohns");
    expect(Array.isArray(result.listings)).toBe(true);

    for (const listing of result.listings) {
      expect(listing.source).toBe("stjohns");
      expect(listing.sourceId).toBeTruthy();
      expect(listing.name).toBeTruthy();
      expect(listing.listingUrl).toBeTruthy();
    }
  }, 60000);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/stjohns.test.ts`
Expected: FAIL

**Step 3: Implement St. John's PetPoint scraper**

Create `src/scrapers/stjohns.ts`:

```typescript
import { chromium } from "playwright";
import type { Scraper, ScraperResult } from "./types.js";
import type { NewCatListing } from "../types.js";

export class StJohnsScraper implements Scraper {
  readonly source = "stjohns";
  private url = "https://apps.stjohns.ca/petpoint/Adoptablepets.aspx";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });

      // Click the Cats tab
      const catsTab = page.locator(
        "button:has-text('Cats'), [onclick*='Cat'], .tablinks:has-text('Cat')",
      );
      if ((await catsTab.count()) > 0) {
        await catsTab.first().click();
        await page.waitForTimeout(2000);
      }

      const listings = await page.evaluate(() => {
        const cards: Array<{
          name: string;
          photoUrl: string;
          age: string;
          sex: string;
          breed: string;
          description: string;
          sourceId: string;
        }> = [];

        // PetPoint typically renders animal cards with photos and details
        const elements = document.querySelectorAll(
          ".animal-card, .pet-card, [class*='animal'], [class*='pet'], tr, .card",
        );

        elements.forEach((el) => {
          const imgEl = el.querySelector("img");
          const text = el.textContent || "";

          // PetPoint often shows: Name, Breed, Age, Sex in structured format
          const nameMatch = text.match(/^([A-Z][\w\s]+?)(?:\n|breed|age|sex)/i);
          const name =
            nameMatch?.[1]?.trim() ||
            el.querySelector("h2, h3, h4, strong, b")?.textContent?.trim() ||
            "";

          const photoUrl = imgEl?.getAttribute("src") || "";
          const ageMatch = text.match(/age[:\s]*([\w\s]+?)(?:\n|,|$)/i);
          const sexMatch = text.match(/(male|female)/i);
          const breedMatch = text.match(/breed[:\s]*([\w\s]+?)(?:\n|,|$)/i);

          if (name && name.length > 1 && name.length < 50) {
            cards.push({
              name,
              photoUrl,
              age: ageMatch?.[1]?.trim() || "",
              sex: sexMatch?.[1] || "Unknown",
              breed: breedMatch?.[1]?.trim() || "",
              description: text.substring(0, 500).trim(),
              sourceId:
                name.toLowerCase().replace(/\s+/g, "-") +
                "-" +
                (photoUrl || Math.random()),
            });
          }
        });

        return cards;
      });

      const result: NewCatListing[] = listings.map((l) => ({
        source: this.source,
        sourceId: l.sourceId,
        name: l.name,
        photoUrl: l.photoUrl,
        age: l.age,
        sex: l.sex,
        breed: l.breed,
        description: l.description,
        listingUrl: this.url,
      }));

      return { listings: result, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
```

> **Note:** PetPoint is the trickiest of the 4. During implementation, dump the page HTML and inspect the real DOM. The tab-click logic and card selectors will almost certainly need refinement.

**Step 4: Run test**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/stjohns.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/scrapers/stjohns.ts tests/scrapers/stjohns.test.ts
git commit -m "feat: City of St. John's PetPoint scraper"
```

---

### Task 7: PetPlace Scraper

**Files:**

- Create: `src/scrapers/petplace.ts`
- Create: `tests/scrapers/petplace.test.ts`

**Context:** https://www.petplace.com/pet-adoption/ is a national aggregator. We need to navigate to cat search filtered by St. John's, NL.

**Step 1: Explore PetPlace search**

Open in browser and inspect:

- The search flow (what URL does a cat search for St. John's NL produce?)
- Network tab for any API calls (Petfinder, Adopt-a-Pet, etc.)

Run: `curl -s "https://www.petplace.com/pet-adoption/" | grep -i "api\|fetch\|endpoint\|petfinder\|adoptapet" | head -20`

**Step 2: Write failing test**

Create `tests/scrapers/petplace.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PetplaceScraper } from "../../src/scrapers/petplace.js";

describe("PetplaceScraper", () => {
  it("has correct source name", () => {
    const scraper = new PetplaceScraper();
    expect(scraper.source).toBe("petplace");
  });

  it("returns listings with required fields", async () => {
    const scraper = new PetplaceScraper();
    const result = await scraper.scrape();

    expect(result.source).toBe("petplace");
    expect(Array.isArray(result.listings)).toBe(true);

    for (const listing of result.listings) {
      expect(listing.source).toBe("petplace");
      expect(listing.sourceId).toBeTruthy();
      expect(listing.name).toBeTruthy();
      expect(listing.listingUrl).toBeTruthy();
    }
  }, 60000);
});
```

**Step 3: Run test to verify it fails**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/petplace.test.ts`
Expected: FAIL

**Step 4: Implement PetPlace scraper**

Create `src/scrapers/petplace.ts`:

```typescript
import { chromium } from "playwright";
import type { Scraper, ScraperResult } from "./types.js";
import type { NewCatListing } from "../types.js";

export class PetplaceScraper implements Scraper {
  readonly source = "petplace";
  // Navigate to PetPlace and search for cats in St. John's, NL
  private url = "https://www.petplace.com/pet-adoption/";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(this.url, { waitUntil: "networkidle", timeout: 30000 });

      // Fill in search for cats in St. John's, NL
      // The exact flow depends on the site's search UI — inspect and adapt
      const locationInput = page.locator(
        "input[placeholder*='location' i], input[name*='location' i], input[type='search']",
      );
      if ((await locationInput.count()) > 0) {
        await locationInput.first().fill("St. John's, NL");
        await page.waitForTimeout(1000);
      }

      // Look for species/type selector
      const catOption = page.locator(
        "select option:has-text('Cat'), button:has-text('Cat'), [data-species='cat']",
      );
      if ((await catOption.count()) > 0) {
        await catOption.first().click();
      }

      // Submit search
      const searchBtn = page.locator(
        "button[type='submit'], button:has-text('Search'), .search-button",
      );
      if ((await searchBtn.count()) > 0) {
        await searchBtn.first().click();
        await page.waitForTimeout(3000);
      }

      const listings = await page.evaluate(() => {
        const cards: Array<{
          name: string;
          photoUrl: string;
          age: string;
          sex: string;
          breed: string;
          description: string;
          listingUrl: string;
          sourceId: string;
        }> = [];

        const elements = document.querySelectorAll(
          ".pet-card, .animal-card, [class*='pet-result'], [class*='search-result'], article",
        );

        elements.forEach((el) => {
          const linkEl = el.querySelector("a[href]");
          const imgEl = el.querySelector("img");
          const titleEl = el.querySelector(
            "h2, h3, h4, .pet-name, .animal-name",
          );

          const name = titleEl?.textContent?.trim() || "";
          const listingUrl = linkEl?.getAttribute("href") || "";
          const photoUrl =
            imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

          const text = el.textContent || "";
          const ageMatch = text.match(/age[:\s]*([\w\s]+?)(?:\n|,|$)/i);
          const sexMatch = text.match(/(male|female)/i);
          const breedMatch = text.match(/breed[:\s]*([\w\s]+?)(?:\n|,|$)/i);

          if (name && listingUrl) {
            cards.push({
              name,
              photoUrl,
              age: ageMatch?.[1]?.trim() || "",
              sex: sexMatch?.[1] || "Unknown",
              breed: breedMatch?.[1]?.trim() || "",
              description: text.substring(0, 500).trim(),
              listingUrl: listingUrl.startsWith("http")
                ? listingUrl
                : `https://www.petplace.com${listingUrl}`,
              sourceId: listingUrl,
            });
          }
        });

        return cards;
      });

      const result: NewCatListing[] = listings.map((l) => ({
        source: this.source,
        sourceId: l.sourceId,
        name: l.name,
        photoUrl: l.photoUrl,
        age: l.age,
        sex: l.sex,
        breed: l.breed,
        description: l.description,
        listingUrl: l.listingUrl,
      }));

      return { listings: result, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
```

> **Note:** PetPlace's search flow is the most unpredictable. During implementation, use Playwright's `page.screenshot()` and `page.content()` to debug the search flow. The search input selectors and flow will need to be adapted to the real UI.

**Step 5: Run test**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/scrapers/petplace.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/scrapers/petplace.ts tests/scrapers/petplace.test.ts
git commit -m "feat: PetPlace scraper for St. John's NL cats"
```

---

### Task 8: Discord Bot DM Alerts

**Files:**

- Create: `src/discord.ts`
- Create: `tests/discord.test.ts`

**Step 1: Write failing test**

Create `tests/discord.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildKittenEmbed } from "../../src/discord.js";
import type { CatListing } from "../../src/types.js";

const mockListing: CatListing = {
  id: "abc-123",
  source: "spca",
  sourceId: "cat-1",
  name: "Mittens",
  photoUrl: "https://example.com/mittens.jpg",
  age: "kitten",
  sex: "Female",
  breed: "Domestic Shorthair",
  description: "A sweet little kitten looking for a home",
  listingUrl: "https://spcastjohns.org/adopt/mittens",
  firstSeen: "2026-03-01T12:00:00Z",
  lastSeen: "2026-03-01T12:00:00Z",
  isActive: 1,
};

describe("buildKittenEmbed", () => {
  it("creates a Discord embed with kitten details", () => {
    const embed = buildKittenEmbed(mockListing);
    expect(embed.title).toBe("Mittens");
    expect(embed.url).toBe("https://spcastjohns.org/adopt/mittens");
    expect(embed.fields).toBeDefined();
    expect(embed.fields!.some((f: { name: string }) => f.name === "Age")).toBe(
      true,
    );
    expect(embed.fields!.some((f: { name: string }) => f.name === "Sex")).toBe(
      true,
    );
    expect(embed.thumbnail?.url).toBe("https://example.com/mittens.jpg");
  });

  it("includes source badge in footer", () => {
    const embed = buildKittenEmbed(mockListing);
    expect(embed.footer?.text).toContain("spca");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/discord.test.ts`
Expected: FAIL

**Step 3: Implement Discord module**

Create `src/discord.ts`:

```typescript
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import type { CatListing } from "./types.js";

const SOURCE_LABELS: Record<string, string> = {
  spca: "SPCA St. John's",
  heavenly: "Heavenly Creatures",
  stjohns: "City of St. John's",
  petplace: "PetPlace.com",
};

const SOURCE_COLORS: Record<string, number> = {
  spca: 0x2ecc71,
  heavenly: 0x9b59b6,
  stjohns: 0x3498db,
  petplace: 0xe67e22,
};

export interface KittenEmbed {
  title: string;
  url: string;
  description?: string;
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  color?: number;
}

export function buildKittenEmbed(listing: CatListing): KittenEmbed {
  const fields = [
    { name: "Age", value: listing.age || "Unknown", inline: true },
    { name: "Sex", value: listing.sex || "Unknown", inline: true },
    { name: "Breed", value: listing.breed || "Unknown", inline: true },
  ];

  return {
    title: listing.name,
    url: listing.listingUrl,
    description: listing.description?.substring(0, 200) || undefined,
    thumbnail: listing.photoUrl ? { url: listing.photoUrl } : undefined,
    fields,
    footer: {
      text: `Source: ${SOURCE_LABELS[listing.source] || listing.source}`,
    },
    color: SOURCE_COLORS[listing.source] || 0x95a5a6,
  };
}

export async function sendKittenAlerts(
  listings: CatListing[],
  botToken: string,
  userId: string,
): Promise<void> {
  if (listings.length === 0) return;

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    await client.login(botToken);

    const user = await client.users.fetch(userId);

    for (const listing of listings) {
      const embedData = buildKittenEmbed(listing);
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setURL(embedData.url)
        .setColor(embedData.color || 0x95a5a6);

      if (embedData.description) embed.setDescription(embedData.description);
      if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail.url);
      if (embedData.fields) {
        for (const field of embedData.fields) {
          embed.addFields({
            name: field.name,
            value: field.value,
            inline: field.inline,
          });
        }
      }
      if (embedData.footer) embed.setFooter({ text: embedData.footer.text });

      await user.send({ embeds: [embed] });
    }

    console.log(`Sent ${listings.length} kitten alert(s) to Discord`);
  } finally {
    await client.destroy();
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/amelie/kitten-finder && npx vitest run tests/discord.test.ts`
Expected: PASS (tests only exercise `buildKittenEmbed`, no actual Discord connection needed)

**Step 5: Commit**

```bash
git add src/discord.ts tests/discord.test.ts
git commit -m "feat: Discord bot DM alerts with rich embeds"
```

---

### Task 9: Dashboard Frontend

**Files:**

- Create: `src/server.ts`
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

**Step 1: Write the Express server with API endpoint**

Create `src/server.ts`:

```typescript
import express from "express";
import path from "path";
import type { Database } from "better-sqlite3";
import { getActiveListings } from "./db.js";

export function createServer(db: Database, port = 3000) {
  const app = express();

  app.use(express.static(path.join(import.meta.dirname, "..", "public")));

  app.get("/api/listings", (req, res) => {
    const filters: Record<string, string> = {};
    if (typeof req.query.source === "string") filters.source = req.query.source;
    if (typeof req.query.sex === "string") filters.sex = req.query.sex;
    if (typeof req.query.age === "string") filters.age = req.query.age;

    const listings = getActiveListings(db, filters);
    res.json(listings);
  });

  const server = app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });

  return server;
}
```

**Step 2: Create the dashboard HTML**

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kitten Finder for Callie</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header>
      <h1>Kitten Finder for Callie</h1>
      <p class="subtitle">Finding a friend in St. John's, NL</p>
    </header>

    <div class="filters">
      <select id="filter-source">
        <option value="">All Sources</option>
        <option value="spca">SPCA St. John's</option>
        <option value="heavenly">Heavenly Creatures</option>
        <option value="stjohns">City of St. John's</option>
        <option value="petplace">PetPlace.com</option>
      </select>

      <select id="filter-sex">
        <option value="">Any Sex</option>
        <option value="Female">Female</option>
        <option value="Male">Male</option>
      </select>

      <select id="filter-age">
        <option value="">Any Age</option>
        <option value="kitten">Kitten</option>
        <option value="young">Young</option>
        <option value="adult">Adult</option>
      </select>

      <select id="sort-by">
        <option value="newest">Newest First</option>
        <option value="name">Alphabetical</option>
      </select>
    </div>

    <div id="listings" class="card-grid"></div>

    <script src="app.js"></script>
  </body>
</html>
```

**Step 3: Create the stylesheet**

Create `public/style.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f0eb;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  padding: 30px 0 20px;
}

header h1 {
  font-size: 2rem;
  color: #6b4c3b;
}

.subtitle {
  color: #8b7355;
  margin-top: 4px;
}

.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 16px 0;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #d4c5b0;
  border-radius: 8px;
  background: white;
  font-size: 0.9rem;
  color: #555;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s;
  position: relative;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.card img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  background: #e8ddd0;
}

.card-body {
  padding: 16px;
}

.card-body h3 {
  font-size: 1.2rem;
  color: #4a3728;
  margin-bottom: 8px;
}

.card-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-source {
  background: #e8ddd0;
  color: #6b4c3b;
}

.badge-new {
  background: #fde68a;
  color: #92400e;
}

.badge-sex {
  background: #dbeafe;
  color: #1e40af;
}

.badge-age {
  background: #d1fae5;
  color: #065f46;
}

.card-link {
  display: inline-block;
  margin-top: 8px;
  color: #6b4c3b;
  font-weight: 600;
  text-decoration: none;
}

.card-link:hover {
  text-decoration: underline;
}

.no-photo {
  width: 100%;
  height: 220px;
  background: #e8ddd0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a89279;
  font-size: 3rem;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #8b7355;
}
```

**Step 4: Create the frontend JavaScript**

Create `public/app.js`:

```javascript
const SOURCE_LABELS = {
  spca: "SPCA St. John's",
  heavenly: "Heavenly Creatures",
  stjohns: "City of St. John's",
  petplace: "PetPlace.com",
};

async function fetchListings() {
  const source = document.getElementById("filter-source").value;
  const sex = document.getElementById("filter-sex").value;
  const age = document.getElementById("filter-age").value;

  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (sex) params.set("sex", sex);
  if (age) params.set("age", age);

  const res = await fetch(`/api/listings?${params}`);
  return res.json();
}

function isNew(listing) {
  const firstSeen = new Date(listing.firstSeen);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return firstSeen > dayAgo;
}

function renderListings(listings) {
  const container = document.getElementById("listings");
  const sortBy = document.getElementById("sort-by").value;

  if (sortBy === "name") {
    listings.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    listings.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
  }

  if (listings.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No kittens found right now. Check back soon!</p></div>';
    return;
  }

  container.innerHTML = listings
    .map(
      (listing) => `
    <div class="card">
      ${
        listing.photoUrl
          ? `<img src="${listing.photoUrl}" alt="${listing.name}" onerror="this.outerHTML='<div class=\\'no-photo\\'>🐱</div>'">`
          : '<div class="no-photo">🐱</div>'
      }
      <div class="card-body">
        <h3>${listing.name}</h3>
        <div class="card-meta">
          <span class="badge badge-source">${SOURCE_LABELS[listing.source] || listing.source}</span>
          ${isNew(listing) ? '<span class="badge badge-new">New!</span>' : ""}
          ${listing.sex && listing.sex !== "Unknown" ? `<span class="badge badge-sex">${listing.sex}</span>` : ""}
          ${listing.age ? `<span class="badge badge-age">${listing.age}</span>` : ""}
        </div>
        ${listing.breed ? `<p style="font-size:0.85rem;color:#666;margin-bottom:6px">${listing.breed}</p>` : ""}
        <a class="card-link" href="${listing.listingUrl}" target="_blank" rel="noopener">View listing →</a>
      </div>
    </div>
  `,
    )
    .join("");
}

async function update() {
  const listings = await fetchListings();
  renderListings(listings);
}

document.getElementById("filter-source").addEventListener("change", update);
document.getElementById("filter-sex").addEventListener("change", update);
document.getElementById("filter-age").addEventListener("change", update);
document.getElementById("sort-by").addEventListener("change", update);

update();
```

**Step 5: Commit**

```bash
git add src/server.ts public/index.html public/style.css public/app.js
git commit -m "feat: dashboard with card grid, filters, and new-listing badges"
```

---

### Task 10: Main Entry Point — Wire Everything Together

**Files:**

- Modify: `src/index.ts`

**Step 1: Write the main orchestrator**

Replace `src/index.ts` with:

```typescript
import "dotenv/config";
import cron from "node-cron";
import { createDb, upsertListings, deactivateMissing } from "./db.js";
import { createServer } from "./server.js";
import { runAllScrapers } from "./scrapers/base.js";
import { sendKittenAlerts } from "./discord.js";
import { SpcaScraper } from "./scrapers/spca.js";
import { HeavenlyScraper } from "./scrapers/heavenly.js";
import { StJohnsScraper } from "./scrapers/stjohns.js";
import { PetplaceScraper } from "./scrapers/petplace.js";
import type { CatListing } from "./types.js";

const db = createDb();
const port = parseInt(process.env.PORT || "3000", 10);
const intervalHours = parseInt(process.env.SCRAPE_INTERVAL_HOURS || "4", 10);
const discordToken = process.env.DISCORD_BOT_TOKEN || "";
const discordUserId = process.env.DISCORD_USER_ID || "";

const scrapers = [
  new SpcaScraper(),
  new HeavenlyScraper(),
  new StJohnsScraper(),
  new PetplaceScraper(),
];

async function runScrapeJob() {
  console.log(`[${new Date().toISOString()}] Starting scrape job...`);

  const results = await runAllScrapers(scrapers);
  const allNewListings: CatListing[] = [];

  for (const result of results) {
    const { newListings } = upsertListings(db, result.listings);
    allNewListings.push(...newListings);

    // Deactivate listings from this source that weren't in the scrape
    const activeIds = result.listings.map((l) => l.sourceId);
    deactivateMissing(db, result.source, activeIds);
  }

  console.log(
    `Scrape complete. ${allNewListings.length} new listing(s) found.`,
  );

  if (allNewListings.length > 0 && discordToken && discordUserId) {
    try {
      await sendKittenAlerts(allNewListings, discordToken, discordUserId);
    } catch (err) {
      console.error(
        "Failed to send Discord alerts:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// Start dashboard
createServer(db, port);

// Run initial scrape
runScrapeJob();

// Schedule recurring scrapes
const cronExpr = `0 */${intervalHours} * * *`;
cron.schedule(cronExpr, () => {
  runScrapeJob();
});

console.log(`Kitten Finder running! Dashboard at http://localhost:${port}`);
console.log(`Scraping every ${intervalHours} hours`);
```

**Step 2: Verify it starts**

Run: `cd /Users/amelie/kitten-finder && npm run dev`
Expected: Server starts, initial scrape kicks off, dashboard accessible at `http://localhost:3000`

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up main entry point with cron, scrapers, discord, and dashboard"
```

---

### Task 11: Scraper Selector Refinement

**This is the most important task.** The scrapers in Tasks 4-7 use best-guess CSS selectors. Each scraper needs to be tested against the live site and its selectors refined.

**For each scraper (spca, heavenly, stjohns, petplace):**

**Step 1: Dump rendered HTML**

Add a temporary debug script at `src/debug-scraper.ts`:

```typescript
import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const url = process.argv[2];
if (!url) {
  console.error("Usage: tsx src/debug-scraper.ts <url>");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);

  // For St. John's, click the Cats tab first
  if (url.includes("petpoint")) {
    const tab = page.locator("button:has-text('Cats'), [onclick*='Cat']");
    if ((await tab.count()) > 0) {
      await tab.first().click();
      await page.waitForTimeout(2000);
    }
  }

  const html = await page.content();
  const filename = `/tmp/debug-${Date.now()}.html`;
  writeFileSync(filename, html);
  console.log(`Saved to ${filename}`);

  await page.screenshot({
    path: `/tmp/debug-${Date.now()}.png`,
    fullPage: true,
  });
  console.log("Screenshot saved");

  await browser.close();
})();
```

**Step 2: Run for each site**

```bash
npx tsx src/debug-scraper.ts "https://spcastjohns.org/adopt/cat/"
npx tsx src/debug-scraper.ts "https://heavenlycreatures.ca/adoptions/available-cats/"
npx tsx src/debug-scraper.ts "https://apps.stjohns.ca/petpoint/Adoptablepets.aspx"
npx tsx src/debug-scraper.ts "https://www.petplace.com/pet-adoption/"
```

**Step 3: Inspect the dumped HTML and screenshots**

Open each HTML file in a browser. Use browser DevTools to identify:

- The correct container selector for listing cards
- The correct selectors for name, photo, age, sex, breed, link
- Whether data is in structured elements or needs regex extraction from text

**Step 4: Update each scraper's `page.evaluate` with correct selectors**

Modify `src/scrapers/spca.ts`, `heavenly.ts`, `stjohns.ts`, `petplace.ts` with the real selectors found in Step 3.

**Step 5: Run all scraper tests**

Run: `cd /Users/amelie/kitten-finder && npx vitest run`
Expected: All tests pass, scrapers return actual listings

**Step 6: Commit**

```bash
git add src/scrapers/ src/debug-scraper.ts
git commit -m "fix: refine scraper selectors based on live site inspection"
```

---

### Task 12: End-to-End Manual Test

**Step 1: Create .env file**

```bash
cp .env.example .env
```

Edit `.env` with real Discord bot token and user ID.

**Step 2: Run the app**

```bash
npm run dev
```

**Step 3: Verify:**

- [ ] Dashboard loads at `http://localhost:3000`
- [ ] Cards appear with data from scraped sites
- [ ] Filters work (source, sex, age)
- [ ] Sort works (newest first, alphabetical)
- [ ] "New" badges appear on recent listings
- [ ] Discord DM received with kitten embeds

**Step 4: Fix any issues found**

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification complete"
```
