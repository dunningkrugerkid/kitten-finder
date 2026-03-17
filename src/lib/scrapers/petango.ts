import { chromium } from "playwright";
import { normalizeAge, type NewCatListing } from "../types.js";
import type { PetangoShelter } from "../config.js";
import type { Scraper, ScraperResult } from "./types.js";

const PETANGO_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals.aspx";

const PETANGO_DETAILS_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx";

const DEFAULT_CSS =
  "https://ws.petango.com/WebServices/adoptablesearch/css/styles.css";

export interface PetangoUrlOptions {
  authKey: string;
  cssUrl?: string;
  detailsInPopup?: boolean;
}

export function buildPetangoUrl(opts: PetangoUrlOptions): string {
  const params = new URLSearchParams({
    species: "Cat",
    sex: "A",
    agegroup: "All",
    onhold: "A",
    orderby: "Random",
    colnum: "3",
    css: opts.cssUrl ?? DEFAULT_CSS,
    authkey: opts.authKey,
    detailsInPopup: opts.detailsInPopup ? "Yes" : "No",
    featuredPet: "Include",
    stageID: "",
  });

  return `${PETANGO_BASE}?${params.toString()}`;
}

export function buildDetailsUrl(sourceId: string, authKey: string): string {
  return `${PETANGO_DETAILS_BASE}?id=${sourceId}&authkey=${authKey}`;
}

export class PetangoScraper implements Scraper {
  readonly source: string;
  private config: PetangoShelter;

  constructor(config: PetangoShelter) {
    this.source = config.key;
    this.config = config;
  }

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const url = buildPetangoUrl({
        authKey: this.config.authKey,
        cssUrl: this.config.cssUrl,
        detailsInPopup: this.config.detailsInPopup,
      });

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      try {
        await page.waitForSelector("td.list-item", { timeout: 15_000 });
      } catch {
        return { listings: [], source: this.source };
      }

      const listings = await page.$$eval("td.list-item", (cells) => {
        return cells.map((cell) => {
          const name =
            cell.querySelector(".list-animal-name a")?.textContent?.trim() ??
            "";
          const sourceId =
            cell.querySelector(".list-animal-id")?.textContent?.trim() ?? "";
          const sexRaw =
            cell.querySelector(".list-animal-sexSN")?.textContent?.trim() ?? "";
          const breed =
            cell.querySelector(".list-animal-breed")?.textContent?.trim() ?? "";
          const age =
            cell.querySelector(".list-animal-age")?.textContent?.trim() ?? "";
          const photoUrl =
            cell.querySelector(".list-animal-photo")?.getAttribute("src") ?? "";

          const sex = sexRaw.split("/")[0] || sexRaw;

          return { name, sourceId, sex, breed, age, photoUrl };
        });
      });

      const results: NewCatListing[] = listings
        .filter((l) => l.sourceId !== "")
        .map((l) => ({
          source: this.source,
          sourceId: l.sourceId,
          name: l.name,
          photoUrl: l.photoUrl,
          age: normalizeAge(l.age),
          sex: l.sex,
          breed: l.breed,
          description: "",
          listingUrl: buildDetailsUrl(l.sourceId, this.config.authKey),
        }));

      return { listings: results, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
