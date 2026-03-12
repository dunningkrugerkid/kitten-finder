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
    scrapeIntervalHours: Number(process.env.SCRAPE_INTERVAL_HOURS ?? 6),
    dbPath: process.env.DB_PATH ?? "kittens.db",
    port: Number(process.env.PORT ?? 4321),
  };
}
