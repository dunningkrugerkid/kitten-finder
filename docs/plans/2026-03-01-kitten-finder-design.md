# Kitten Finder for Callie — Design Document

## Purpose

A personal dashboard and alert system that scrapes adoption centres and breeders in St. John's, Newfoundland for available kittens. Aggregates listings from multiple sources into one place with Discord DM alerts for new listings.

## Sources

1. **SPCA St. John's** — https://spcastjohns.org/adopt/cat/ (WordPress, dynamic loading)
2. **Heavenly Creatures** — https://heavenlycreatures.ca/adoptions/available-cats/ (WordPress, dynamic loading)
3. **City of St. John's** — https://www.stjohns.ca/en/living-in-st-johns/adopt-a-pet.aspx → PetPoint app (JS tabs, dynamic)
4. **PetPlace.com** — https://www.petplace.com/pet-adoption/ (national aggregator, filtered to St. John's)

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Scraping:** Hybrid — Playwright (headless browser) for JS-heavy sites, direct HTTP/API calls where endpoints are discoverable (e.g., WordPress REST API)
- **Database:** SQLite via better-sqlite3
- **Frontend:** Static HTML/CSS/JS dashboard served by Express
- **Scheduling:** node-cron (every ~4 hours)
- **Alerts:** Discord bot DMs via discord.js

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────┐
│  node-cron  │───▶│   Scrapers   │───▶│  SQLite  │
│  (4 hours)  │    │ (per source) │    │    DB    │
└─────────────┘    └──────────────┘    └────┬─────┘
                          │                 │
                          ▼                 ▼
                   ┌──────────────┐  ┌──────────────┐
                   │ Discord Bot  │  │   Express     │
                   │  (DM alert)  │  │  (dashboard)  │
                   └──────────────┘  └──────────────┘
```

1. Cron triggers scrapers every ~4 hours
2. Each scraper fetches listings from its source and normalizes data
3. New listings are inserted into SQLite; duplicates detected by source + sourceId
4. When new listings are found, the Discord bot DMs the user with a preview
5. The dashboard reads from SQLite and displays all current listings with filters

## Data Model

| Field       | Type    | Description                                           |
| ----------- | ------- | ----------------------------------------------------- |
| id          | TEXT PK | UUID                                                  |
| source      | TEXT    | Source identifier (spca, heavenly, stjohns, petplace) |
| sourceId    | TEXT    | ID or URL from original site (deduplication key)      |
| name        | TEXT    | Animal's name                                         |
| photoUrl    | TEXT    | URL to photo                                          |
| age         | TEXT    | Age or age category (kitten, young, adult)            |
| sex         | TEXT    | Male / Female / Unknown                               |
| breed       | TEXT    | Breed if available                                    |
| description | TEXT    | Bio/description text                                  |
| listingUrl  | TEXT    | Direct link to original listing                       |
| firstSeen   | TEXT    | ISO datetime — when first scraped                     |
| lastSeen    | TEXT    | ISO datetime — last seen in a scrape                  |
| isActive    | INTEGER | 1 if present in most recent scrape, 0 if gone         |

**Unique constraint:** (source, sourceId)

Listings are marked inactive (not deleted) when they disappear, preserving history.

## Dashboard

- **Card grid** — photo, name, age, sex, breed, source badge, link to original
- **Filters** — source site, age category, sex
- **"New" badge** — listings first seen within 24 hours
- **Sort** — newest first (default), alphabetical
- Simple, clean design. No framework overhead.

## Discord Alerts

- Bot DMs the user when new listings are detected
- Each message is a rich embed: photo thumbnail, name, age, sex, breed, source, link
- One message per new listing (batched if multiple found in one scrape cycle)

## Scraping Strategy (Hybrid)

- **WordPress sites (SPCA, Heavenly Creatures):** Try WordPress REST API first (`/wp-json/wp/v2/...`), fall back to Playwright if no usable API
- **City of St. John's (PetPoint):** Playwright — JS-rendered tabs with no visible API
- **PetPlace.com:** Inspect network requests for underlying API; Playwright fallback

## Configuration

Environment variables (`.env` file):

- `DISCORD_BOT_TOKEN` — Discord bot token
- `DISCORD_USER_ID` — User ID to DM
- `SCRAPE_INTERVAL_HOURS` — How often to scrape (default: 4)
- `PORT` — Dashboard port (default: 3000)
