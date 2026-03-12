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
