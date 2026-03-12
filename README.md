# Kitten Finder

Kitten Finder scrapes cat adoption websites, stores listings in SQLite, shows a dashboard, and sends alerts (Discord/webhooks) when new cats appear. Ships with a working St. John's, NL example config.

## Quick Start

```bash
git clone <repo-url>
cd kitten-finder
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env if you want notifications (see below)
npm run build
npm run start
```

Dashboard at <http://localhost:3000>

## Configure Your Shelters

Edit `shelters.config.ts` at the project root. Two types:

### Petango shelters

Many North American shelters use Petango/PetPoint. No custom scraper code needed:

```ts
{
  type: "petango",
  name: "My Local SPCA",
  key: "my-spca",          // unique key, used in database
  authKey: "your-petango-auth-key",
  color: "#2ECC71",        // for dashboard badges and Discord embeds
}
```

To find your shelter's Petango auth key, visit their adoption page and look for a Petango iframe/widget URL containing `authkey=`.

### Custom scrapers

For non-Petango sites:

```ts
{
  type: "custom",
  name: "Some Rescue",
  key: "some-rescue",
  color: "#9B59B6",
  scraperPath: "./src/scrapers/some-rescue.ts",
}
```

Copy `src/lib/scrapers/_template.ts` as a starting point. See `src/lib/scrapers/heavenly.ts` for a real example.

## Notifications

Both are optional. Configure via `.env`:

### Discord

Create a bot at <https://discord.com/developers/applications>, add it to a server, and copy the token:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_USER_ID=your_user_id
```

### Webhooks

Sends a JSON POST with listing data to any URL:

```env
WEBHOOK_URL=https://your-endpoint.com/hook
```

Webhook payload shape:

```json
{
  "event": "new_listings",
  "count": 2,
  "listings": [
    {
      "name": "...",
      "source": "...",
      "age": "...",
      "sex": "...",
      "breed": "...",
      "photoUrl": "...",
      "listingUrl": "..."
    }
  ]
}
```

## Environment Variables

| Variable                | Default            | Description                      |
| ----------------------- | ------------------ | -------------------------------- |
| `SCRAPE_INTERVAL_HOURS` | `4`                | How often to scrape              |
| `DB_PATH`               | `kitten-finder.db` | SQLite database path             |
| `PORT`                  | `3000`             | Dashboard port                   |
| `DISCORD_BOT_TOKEN`     | --                 | Discord bot token (optional)     |
| `DISCORD_USER_ID`       | --                 | Discord user ID to DM (optional) |
| `WEBHOOK_URL`           | --                 | Webhook endpoint URL (optional)  |

## Docker

```bash
cp .env.example .env
# Edit .env
docker compose up -d
```

## Development

```bash
npm run dev      # Astro dev server
npm run test     # Run tests
npm run build    # Production build
```

## Note

The default `shelters.config.ts` ships with St. John's, NL shelters as a working example. Fork and replace with your own!
