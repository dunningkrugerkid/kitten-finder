import "dotenv/config";
import cron from "node-cron";
import { createDb } from "./lib/db.js";
import { runScrapeJob } from "./lib/scrape-job.js";
import { loadConfig, buildScrapers, buildNotifiers } from "./lib/config.js";

const config = await loadConfig();
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
