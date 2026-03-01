import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import type { CatListing } from "./types";

export interface KittenEmbed {
  title: string;
  url: string;
  description?: string;
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  color?: number;
}

const SOURCE_LABELS: Record<string, string> = {
  spca: "SPCA St. John's",
  heavenly: "Heavenly Creatures",
  stjohns: "City of St. John's",
};

const SOURCE_COLORS: Record<string, number> = {
  spca: 0x2ecc71, // green
  heavenly: 0x9b59b6, // purple
  stjohns: 0x3498db, // blue
};

const DEFAULT_COLOR = 0x95a5a6; // grey

export function buildKittenEmbed(listing: CatListing): KittenEmbed {
  const label = SOURCE_LABELS[listing.source] ?? listing.source;
  const color = SOURCE_COLORS[listing.source] ?? DEFAULT_COLOR;

  return {
    title: listing.name,
    url: listing.listingUrl,
    description: listing.description || undefined,
    thumbnail: listing.photoUrl ? { url: listing.photoUrl } : undefined,
    fields: [
      { name: "Age", value: listing.age, inline: true },
      { name: "Sex", value: listing.sex, inline: true },
      { name: "Breed", value: listing.breed, inline: true },
    ],
    footer: { text: label },
    color,
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
      const data = buildKittenEmbed(listing);
      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setURL(data.url)
        .setColor(data.color ?? null)
        .setFields(data.fields ?? [])
        .setFooter(data.footer ?? null);

      if (data.description) {
        embed.setDescription(data.description);
      }

      if (data.thumbnail) {
        embed.setThumbnail(data.thumbnail.url);
      }

      await user.send({ embeds: [embed] });
    }
  } finally {
    client.destroy();
  }
}
