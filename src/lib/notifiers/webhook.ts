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
