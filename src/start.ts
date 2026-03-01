import "dotenv/config";
import cron from "node-cron";
import { createDb } from "./lib/db.js";
import { runScrapeJob } from "./lib/scrape-job.js";

const dbPath = process.env.DB_PATH || "kitten-finder.db";
const db = createDb(dbPath);
const intervalHours = parseInt(process.env.SCRAPE_INTERVAL_HOURS || "4", 10);
const discordToken = process.env.DISCORD_BOT_TOKEN || "";
const discordUserId = process.env.DISCORD_USER_ID || "";

// Run initial scrape
runScrapeJob(db, discordToken, discordUserId);

// Schedule recurring scrapes
const cronExpr = `0 */${intervalHours} * * *`;
cron.schedule(cronExpr, () => {
  runScrapeJob(db, discordToken, discordUserId);
});

console.log(`Kitten Finder scraper running — every ${intervalHours} hours`);

// Import and start the Astro standalone server
const entry = await import("../dist/server/entry.mjs");
entry.startServer();
