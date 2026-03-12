# Fork-Friendly Kitten Finder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor kitten-finder so anyone can fork it, configure their own shelters and notifications, and be running in minutes — using the St. John's setup as a working example.

**Architecture:** Config-driven shelter definitions with a generic Petango scraper and custom scraper escape hatch. Notification system abstracted behind a `Notifier` interface with Discord and webhook implementations. Dashboard dynamically reads source labels/colors from config.

**Tech Stack:** TypeScript, Astro, Playwright, SQLite, Discord.js, node-cron (all unchanged)

---

### Task 1: Shelter config types and file

**Files:**

- Create: `src/lib/config.ts`

**Step 1: Create the shelter config types and loader**

```ts
// src/lib/config.ts
import type { Scraper } from "./scrapers/types.js";

export interface PetangoShelter {
  type: "petango";
  name: string;
  key: string; // source key used in DB, e.g. "spca"
  authKey: string; // Petango API auth key
  color: string; // hex color for embeds/badges, e.g. "#2ECC71"
  cssUrl?: string; // optional custom CSS URL for the widget
  detailsInPopup?: boolean;
}

export interface CustomShelter {
  type: "custom";
  name: string;
  key: string;
  color: string;
  scraperPath: string; // relative path to scraper module, e.g. "./src/scrapers/heavenly.ts"
}

export type ShelterConfig = PetangoShelter | CustomShelter;

export interface NotificationConfig {
  discord?: {
    botToken: string;
    userId: string;
  };
  webhook?: {
    url: string;
  };
}

export interface AppConfig {
  shelters: ShelterConfig[];
  notifications: NotificationConfig;
  scrapeIntervalHours: number;
  dbPath: string;
  port: number;
}

export function loadConfig(): AppConfig {
  return {
    shelters: (await import("../../shelters.config.js")).default,
    notifications: {
      discord:
        process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_USER_ID
          ? {
              botToken: process.env.DISCORD_BOT_TOKEN,
              userId: process.env.DISCORD_USER_ID,
            }
          : undefined,
      webhook: process.env.WEBHOOK_URL
        ? { url: process.env.WEBHOOK_URL }
        : undefined,
    },
    scrapeIntervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS || "4", 10),
    dbPath: process.env.DB_PATH || "kitten-finder.db",
    port: parseInt(process.env.PORT || "3000", 10),
  };
}
```

**Step 2: Create the shelters config file with St. John's example**

```ts
// shelters.config.ts
import type { ShelterConfig } from "./src/lib/config.js";

const shelters: ShelterConfig[] = [
  {
    type: "petango",
    name: "SPCA St. John's",
    key: "spca",
    authKey: "o8exmnumy8ij0fy3wsebhs082gj44ikqi13yq6b7bg4wcgrxgm",
    color: "#2ECC71",
    cssUrl:
      "https://spcastjohns.org/wp-content/themes/prime/assets/css/adopt.css",
    detailsInPopup: true,
  },
  {
    type: "petango",
    name: "City of St. John's",
    key: "stjohns",
    authKey: "n564epb07r0g7lui0pf0cb3tidbr5bunroe2cisfbusbkqmvn7",
    color: "#3498DB",
  },
  {
    type: "custom",
    name: "Heavenly Creatures",
    key: "heavenly",
    color: "#9B59B6",
    scraperPath: "./src/scrapers/heavenly.ts",
  },
];

export default shelters;
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/config.ts shelters.config.ts
git commit -m "feat: add shelter config types and St. John's example config"
```

---

### Task 2: Generic Petango scraper

**Files:**

- Create: `src/lib/scrapers/petango.ts`
- Modify: `src/lib/scrapers/types.ts` (no changes needed — Scraper interface already fits)

**Step 1: Write test for Petango scraper URL construction**

```ts
// src/lib/scrapers/petango.test.ts
import { describe, it, expect } from "vitest";
import { buildPetangoUrl, buildDetailsUrl } from "./petango.js";

describe("buildPetangoUrl", () => {
  it("includes the auth key in the URL", () => {
    const url = buildPetangoUrl({ authKey: "test123" });
    expect(url).toContain("authkey=test123");
  });

  it("includes custom CSS URL when provided", () => {
    const url = buildPetangoUrl({
      authKey: "test123",
      cssUrl: "https://example.com/styles.css",
    });
    expect(url).toContain("css=https%3A%2F%2Fexample.com%2Fstyles.css");
  });

  it("uses default CSS when no custom CSS provided", () => {
    const url = buildPetangoUrl({ authKey: "test123" });
    expect(url).toContain("css=https%3A%2F%2Fws.petango.com");
  });

  it("sets detailsInPopup based on config", () => {
    const withPopup = buildPetangoUrl({
      authKey: "test123",
      detailsInPopup: true,
    });
    expect(withPopup).toContain("detailsInPopup=Yes");

    const withoutPopup = buildPetangoUrl({
      authKey: "test123",
      detailsInPopup: false,
    });
    expect(withoutPopup).toContain("detailsInPopup=No");
  });
});

describe("buildDetailsUrl", () => {
  it("constructs detail URL with sourceId and authKey", () => {
    const url = buildDetailsUrl("A12345", "mykey");
    expect(url).toBe(
      "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx?id=A12345&authkey=mykey",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scrapers/petango.test.ts`
Expected: FAIL — module not found

**Step 3: Write the generic Petango scraper**

```ts
// src/lib/scrapers/petango.ts
import { chromium } from "playwright";
import type { NewCatListing } from "../types.js";
import type { Scraper, ScraperResult } from "./types.js";
import type { PetangoShelter } from "../config.js";

const PETANGO_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals.aspx";
const PETANGO_DETAILS_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx";
const DEFAULT_CSS =
  "https://ws.petango.com/WebServices/adoptablesearch/css/styles.css";

export interface PetangoUrlOptions {
  authKey: string;
  cssUrl?: string;
  detailsInPopup?: boolean;
}

export function buildPetangoUrl(opts: PetangoUrlOptions): string {
  const params = new URLSearchParams({
    species: "Cat",
    sex: "A",
    agegroup: "All",
    onhold: "A",
    orderby: "Random",
    colnum: "3",
    css: opts.cssUrl || DEFAULT_CSS,
    authkey: opts.authKey,
    detailsInPopup: opts.detailsInPopup ? "Yes" : "No",
    featuredPet: "Include",
    stageID: "",
  });
  return `${PETANGO_BASE}?${params.toString()}`;
}

export function buildDetailsUrl(sourceId: string, authKey: string): string {
  return `${PETANGO_DETAILS_BASE}?id=${sourceId}&authkey=${authKey}`;
}

export class PetangoScraper implements Scraper {
  readonly source: string;
  private config: PetangoShelter;

  constructor(config: PetangoShelter) {
    this.source = config.key;
    this.config = config;
  }

  async scrape(): Promise<ScraperResult> {
    const url = buildPetangoUrl({
      authKey: this.config.authKey,
      cssUrl: this.config.cssUrl,
      detailsInPopup: this.config.detailsInPopup,
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

      try {
        await page.waitForSelector("td.list-item", { timeout: 15_000 });
      } catch {
        return { listings: [], source: this.source };
      }

      const listings = await page.$$eval("td.list-item", (cells) => {
        return cells.map((cell) => {
          const name =
            cell.querySelector(".list-animal-name a")?.textContent?.trim() ??
            "";
          const sourceId =
            cell.querySelector(".list-animal-id")?.textContent?.trim() ?? "";
          const sexRaw =
            cell.querySelector(".list-animal-sexSN")?.textContent?.trim() ?? "";
          const breed =
            cell.querySelector(".list-animal-breed")?.textContent?.trim() ?? "";
          const age =
            cell.querySelector(".list-animal-age")?.textContent?.trim() ?? "";
          const photoUrl =
            cell.querySelector(".list-animal-photo")?.getAttribute("src") ?? "";
          const sex = sexRaw.split("/")[0] || sexRaw;
          return { name, sourceId, sex, breed, age, photoUrl };
        });
      });

      const results: NewCatListing[] = listings
        .filter((l) => l.sourceId !== "")
        .map((l) => ({
          source: this.source,
          sourceId: l.sourceId,
          name: l.name,
          photoUrl: l.photoUrl,
          age: l.age,
          sex: l.sex,
          breed: l.breed,
          description: "",
          listingUrl: buildDetailsUrl(l.sourceId, this.config.authKey),
        }));

      return { listings: results, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scrapers/petango.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/scrapers/petango.ts src/lib/scrapers/petango.test.ts
git commit -m "feat: add generic Petango scraper driven by shelter config"
```

---

### Task 3: Notifier interface + webhook notifier

**Files:**

- Create: `src/lib/notifiers/types.ts`
- Create: `src/lib/notifiers/webhook.ts`
- Create: `src/lib/notifiers/webhook.test.ts`
- Create: `src/lib/notifiers/discord.ts`

**Step 1: Create the Notifier interface**

```ts
// src/lib/notifiers/types.ts
import type { CatListing } from "../types.js";

export interface Notifier {
  name: string;
  notify(listings: CatListing[]): Promise<void>;
}
```

**Step 2: Write test for webhook notifier**

```ts
// src/lib/notifiers/webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookNotifier } from "./webhook.js";
import type { CatListing } from "../types.js";

const mockListing: CatListing = {
  id: "1",
  source: "spca",
  sourceId: "A123",
  name: "Whiskers",
  photoUrl: "https://example.com/photo.jpg",
  age: "Kitten",
  sex: "Female",
  breed: "Domestic Shorthair",
  description: "",
  listingUrl: "https://example.com/listing",
  firstSeen: "2026-03-12T00:00:00Z",
  lastSeen: "2026-03-12T00:00:00Z",
  isActive: 1,
};

describe("WebhookNotifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with JSON body to configured URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const notifier = new WebhookNotifier("https://example.com/hook");
    await notifier.notify([mockListing]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0].name).toBe("Whiskers");
  });

  it("does nothing when listings array is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const notifier = new WebhookNotifier("https://example.com/hook");
    await notifier.notify([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/notifiers/webhook.test.ts`
Expected: FAIL — module not found

**Step 4: Implement webhook notifier**

```ts
// src/lib/notifiers/webhook.ts
import type { CatListing } from "../types.js";
import type { Notifier } from "./types.js";

export class WebhookNotifier implements Notifier {
  readonly name = "webhook";
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async notify(listings: CatListing[]): Promise<void> {
    if (listings.length === 0) return;

    await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "new_listings",
        count: listings.length,
        listings: listings.map((l) => ({
          name: l.name,
          source: l.source,
          age: l.age,
          sex: l.sex,
          breed: l.breed,
          photoUrl: l.photoUrl,
          listingUrl: l.listingUrl,
        })),
      }),
    });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/notifiers/webhook.test.ts`
Expected: PASS

**Step 6: Wrap existing Discord logic as a Notifier**

```ts
// src/lib/notifiers/discord.ts
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import type { CatListing } from "../types.js";
import type { Notifier } from "./types.js";
import type { ShelterConfig } from "../config.js";

export class DiscordNotifier implements Notifier {
  readonly name = "discord";
  private botToken: string;
  private userId: string;
  private shelterLabels: Record<string, string>;
  private shelterColors: Record<string, number>;

  constructor(botToken: string, userId: string, shelters: ShelterConfig[]) {
    this.botToken = botToken;
    this.userId = userId;
    this.shelterLabels = Object.fromEntries(
      shelters.map((s) => [s.key, s.name]),
    );
    this.shelterColors = Object.fromEntries(
      shelters.map((s) => [s.key, parseInt(s.color.replace("#", ""), 16)]),
    );
  }

  async notify(listings: CatListing[]): Promise<void> {
    if (listings.length === 0) return;

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    try {
      await client.login(this.botToken);
      const user = await client.users.fetch(this.userId);

      for (const listing of listings) {
        const label = this.shelterLabels[listing.source] ?? listing.source;
        const color = this.shelterColors[listing.source] ?? 0x95a5a6;

        const embed = new EmbedBuilder()
          .setTitle(listing.name)
          .setURL(listing.listingUrl)
          .setColor(color)
          .setFields([
            { name: "Age", value: listing.age || "Unknown", inline: true },
            { name: "Sex", value: listing.sex || "Unknown", inline: true },
            { name: "Breed", value: listing.breed || "Unknown", inline: true },
          ])
          .setFooter({ text: label });

        if (listing.description) embed.setDescription(listing.description);
        if (listing.photoUrl) embed.setThumbnail(listing.photoUrl);

        await user.send({ embeds: [embed] });
      }
    } finally {
      client.destroy();
    }
  }
}
```

**Step 7: Commit**

```bash
git add src/lib/notifiers/
git commit -m "feat: add Notifier interface with webhook and Discord implementations"
```

---

### Task 4: Wire config into scrape-job and start.ts

**Files:**

- Modify: `src/lib/scrape-job.ts`
- Modify: `src/start.ts`
- Modify: `src/lib/config.ts` (add helper to build scrapers + notifiers from config)

**Step 1: Add factory functions to config.ts**

Add to `src/lib/config.ts`:

```ts
import { PetangoScraper } from "./scrapers/petango.js";
import type { Scraper } from "./scrapers/types.js";
import type { Notifier } from "./notifiers/types.js";
import { DiscordNotifier } from "./notifiers/discord.js";
import { WebhookNotifier } from "./notifiers/webhook.js";

export async function buildScrapers(
  shelters: ShelterConfig[],
): Promise<Scraper[]> {
  const scrapers: Scraper[] = [];

  for (const shelter of shelters) {
    if (shelter.type === "petango") {
      scrapers.push(new PetangoScraper(shelter));
    } else {
      // Dynamic import of custom scraper module
      const mod = await import(shelter.scraperPath);
      const ScraperClass =
        mod.default ||
        Object.values(mod).find(
          (v: any) => typeof v === "function" && v.prototype?.scrape,
        );
      if (ScraperClass) {
        scrapers.push(new (ScraperClass as any)());
      } else {
        console.error(
          `[config] Could not load scraper from ${shelter.scraperPath}`,
        );
      }
    }
  }

  return scrapers;
}

export function buildNotifiers(config: AppConfig): Notifier[] {
  const notifiers: Notifier[] = [];

  if (config.notifications.discord) {
    notifiers.push(
      new DiscordNotifier(
        config.notifications.discord.botToken,
        config.notifications.discord.userId,
        config.shelters,
      ),
    );
  }

  if (config.notifications.webhook) {
    notifiers.push(new WebhookNotifier(config.notifications.webhook.url));
  }

  return notifiers;
}
```

**Step 2: Refactor scrape-job.ts to accept scrapers and notifiers**

Replace `src/lib/scrape-job.ts` with:

```ts
import type Database from "better-sqlite3";
import { upsertListings, deactivateMissing } from "./db.js";
import { runAllScrapers } from "./scrapers/runner.js";
import type { Scraper } from "./scrapers/types.js";
import type { Notifier } from "./notifiers/types.js";
import type { CatListing } from "./types.js";

export async function runScrapeJob(
  db: Database.Database,
  scrapers: Scraper[],
  notifiers: Notifier[],
): Promise<{ newCount: number }> {
  console.log(`[${new Date().toISOString()}] Starting scrape job...`);

  const results = await runAllScrapers(scrapers);
  const allNewListings: CatListing[] = [];

  for (const result of results) {
    const { newListings } = upsertListings(db, result.listings);
    allNewListings.push(...newListings);

    const activeIds = result.listings.map((l) => l.sourceId);
    deactivateMissing(db, result.source, activeIds);
  }

  console.log(
    `Scrape complete. ${allNewListings.length} new listing(s) found.`,
  );

  if (allNewListings.length > 0) {
    for (const notifier of notifiers) {
      try {
        await notifier.notify(allNewListings);
      } catch (err) {
        console.error(
          `[${notifier.name}] Failed to send alerts:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { newCount: allNewListings.length };
}
```

**Step 3: Refactor start.ts to use config**

Replace `src/start.ts` with:

```ts
import "dotenv/config";
import cron from "node-cron";
import { createDb } from "./lib/db.js";
import { runScrapeJob } from "./lib/scrape-job.js";
import { loadConfig, buildScrapers, buildNotifiers } from "./lib/config.js";

const config = loadConfig();
const db = createDb(config.dbPath);
const scrapers = await buildScrapers(config.shelters);
const notifiers = buildNotifiers(config);

// Run initial scrape
runScrapeJob(db, scrapers, notifiers);

// Schedule recurring scrapes
const cronExpr = `0 */${config.scrapeIntervalHours} * * *`;
cron.schedule(cronExpr, () => {
  runScrapeJob(db, scrapers, notifiers);
});

console.log(
  `Kitten Finder running — ${scrapers.length} shelter(s), every ${config.scrapeIntervalHours} hours`,
);
```

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/lib/scrape-job.ts src/start.ts src/lib/config.ts
git commit -m "feat: wire shelter config and notifiers into scrape job"
```

---

### Task 5: Update dashboard to read sources from config

**Files:**

- Modify: `src/pages/api/listings.ts` — add a `/api/shelters` style endpoint or embed shelter metadata
- Create: `src/pages/api/shelters.ts` — returns shelter list with names/keys/colors
- Modify: `src/pages/index.astro` — dynamically build source filter dropdown and source labels from `/api/shelters`

**Step 1: Create shelters API endpoint**

```ts
// src/pages/api/shelters.ts
import type { APIRoute } from "astro";
import { loadConfig } from "../../lib/config.js";

const config = loadConfig();

export const GET: APIRoute = () => {
  const shelters = config.shelters.map((s) => ({
    key: s.key,
    name: s.name,
    color: s.color,
  }));

  return new Response(JSON.stringify(shelters), {
    headers: { "Content-Type": "application/json" },
  });
};
```

**Step 2: Update index.astro to fetch shelters dynamically**

In `src/pages/index.astro`, replace the hardcoded `SOURCE_LABELS` object and the hardcoded `<option>` elements in the source filter with dynamic versions:

- Change title from "Kitten Finder for Callie" to "Kitten Finder"
- Change subtitle from "Finding a friend in St. John's, NL" to "Adoptable cats near you"
- Replace the hardcoded source `<option>` list with JS that fetches `/api/shelters` and populates the dropdown
- Replace the `SOURCE_LABELS` constant with data from the shelters API

**Step 3: Verify dashboard loads**

Run: `npm run dev`
Expected: Dashboard loads, source filter populates dynamically

**Step 4: Commit**

```bash
git add src/pages/api/shelters.ts src/pages/index.astro
git commit -m "feat: dashboard reads shelter sources dynamically from config"
```

---

### Task 6: Custom scraper template

**Files:**

- Create: `src/lib/scrapers/_template.ts`

**Step 1: Create the template**

```ts
// src/lib/scrapers/_template.ts
//
// TEMPLATE: Copy this file and rename it for your custom shelter scraper.
//
// 1. Implement the `scrape()` method to return listings from your shelter's website
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
```

**Step 2: Commit**

```bash
git add src/lib/scrapers/_template.ts
git commit -m "feat: add custom scraper template"
```

---

### Task 7: Delete old scraper files

**Files:**

- Delete: `src/lib/scrapers/spca.ts`
- Delete: `src/lib/scrapers/stjohns.ts`
- Modify: `src/lib/scrapers/heavenly.ts` — add `export default` to the class so config loader can import it

**Step 1: Add default export to heavenly.ts**

Change `export class HeavenlyScraper` to `export default class HeavenlyScraper`.

**Step 2: Delete old Petango scraper files**

```bash
rm src/lib/scrapers/spca.ts src/lib/scrapers/stjohns.ts
```

**Step 3: Delete old discord.ts (replaced by notifiers/discord.ts)**

```bash
rm src/lib/discord.ts
```

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors (fix any remaining imports if needed)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove old scraper files, use config-driven system"
```

---

### Task 8: Update .env.example and .gitignore

**Files:**

- Modify: `.env.example`
- Modify: `.gitignore`

**Step 1: Update .env.example**

```env
# ── Scraping ──────────────────────────────────
SCRAPE_INTERVAL_HOURS=4

# ── Database ──────────────────────────────────
DB_PATH=kitten-finder.db

# ── Server ────────────────────────────────────
PORT=3000

# ── Discord Notifications (optional) ──────────
# Create a bot at https://discord.com/developers/applications
# DISCORD_BOT_TOKEN=your_bot_token_here
# DISCORD_USER_ID=your_user_id_here

# ── Webhook Notifications (optional) ──────────
# Sends JSON POST to this URL when new listings are found
# WEBHOOK_URL=https://your-webhook-endpoint.com/hook
```

**Step 2: Add docs/plans/ to .gitignore**

Append `docs/plans/` to `.gitignore`.

**Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: update .env.example with all options, gitignore plans"
```

---

### Task 9: Write README

**Files:**

- Modify: `README.md`

**Step 1: Write the fork-friendly README**

The README should cover:

- What kitten-finder does (1-2 sentences)
- Quick start (clone, npm install, playwright install, configure shelters, run)
- How to add a Petango shelter (add entry to shelters.config.ts — config only)
- How to write a custom scraper (copy template, implement scrape(), add to config)
- Notification setup (Discord bot creation steps, webhook URL)
- Environment variables reference
- Docker deployment
- Note that the default config is a working St. John's NL example

Keep it concise — no need for extensive prose. Code examples inline.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add fork-friendly README with setup and customization guide"
```

---

### Task 10: End-to-end verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Verify dev server starts**

Run: `npm run dev` (manual check — dashboard loads, source filter populated dynamically)

**Step 4: Final commit if any fixes needed**
