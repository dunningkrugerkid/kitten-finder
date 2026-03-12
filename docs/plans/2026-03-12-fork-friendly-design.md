# Fork-Friendly Kitten Finder — Design

**Date:** 2026-03-12
**Goal:** Make kitten-finder easy for others to fork and adapt to their own city/shelters.

## Decisions

- Keep the name "kitten-finder"
- Approach: Hybrid — config-driven for Petango shelters, custom scraper support for everything else
- Notifications: Discord + generic webhooks
- Current St. John's setup stays as the working example

## 1. Shelter Configuration

Single `shelters.config.ts` at project root. Two shelter types:

**Petango (config-only):**

```ts
{
  type: "petango",
  name: "SPCA St. John's",
  authKey: "o8exmnumy8ij0fy3wsebhs082gj44ikqi13yq6b7bg4wcgrxgm",
  color: "#FF6B6B"
}
```

**Custom scraper:**

```ts
{
  type: "custom",
  name: "Heavenly Creatures",
  scraper: "./src/scrapers/heavenly.ts",
  color: "#9B59B6"
}
```

Custom scrapers export `scrape(): Promise<NewCatListing[]>` — same interface as today.

## 2. Generic Petango Scraper

One reusable scraper replaces duplicated `spca.ts` / `stjohns.ts`. Takes auth key + org name from config. Both current Petango scrapers follow the same pattern — navigate to widget URL with auth key, wait for cards, extract listing data.

## 3. Custom Scraper Template

`src/scrapers/_template.ts` — documented template showing the `scrape()` interface. Heavenly Creatures remains as a real-world example of a custom scraper.

## 4. Notification System

Config-driven via `.env`:

- `NOTIFY_DISCORD=true` + `DISCORD_BOT_TOKEN` + `DISCORD_USER_ID`
- `NOTIFY_WEBHOOK=true` + `WEBHOOK_URL`

A `Notifier` interface that both Discord and webhook implement:

```ts
interface Notifier {
  notify(listings: CatListing[], source: string): Promise<void>;
}
```

Webhook sends JSON payload with listing data to the configured URL. Discord stays as-is but behind the interface.

## 5. README

Proper fork-friendly README:

- What it does (with screenshot/description of dashboard)
- Quick start (clone, configure, run)
- How to add a Petango shelter (just add to config)
- How to write a custom scraper (template + Heavenly Creatures as example)
- Notification setup (Discord bot creation, webhook URL)
- Docker deployment
- St. John's setup referenced as the example throughout

## 6. Cleanup

- Source labels and colors move into shelter config (out of discord.ts)
- `.env.example` updated with all options documented
- `docs/plans/` added to `.gitignore`
- Petango auth keys move from hardcoded in scraper files to shelter config
