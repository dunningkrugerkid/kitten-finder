import { PetangoScraper } from "./scrapers/petango.js";
import type { Scraper } from "./scrapers/types.js";
import type { Notifier } from "./notifiers/types.js";
import { DiscordNotifier } from "./notifiers/discord.js";
import { WebhookNotifier } from "./notifiers/webhook.js";

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

export async function loadConfig(): Promise<AppConfig> {
  const { default: shelters } = await import("../../shelters.config.js");

  const notifications: NotificationConfig = {};

  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const discordUserId = process.env.DISCORD_USER_ID;
  if (discordBotToken && discordUserId) {
    notifications.discord = {
      botToken: discordBotToken,
      userId: discordUserId,
    };
  }

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    notifications.webhook = { url: webhookUrl };
  }

  return {
    shelters,
    notifications,
    scrapeIntervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS || "4", 10),
    dbPath: process.env.DB_PATH || "kitten-finder.db",
    port: parseInt(process.env.PORT || "3000", 10),
  };
}

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
