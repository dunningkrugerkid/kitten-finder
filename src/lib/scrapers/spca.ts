import { chromium } from "playwright";
import type { NewCatListing } from "../types.js";
import type { Scraper, ScraperResult } from "./types.js";

const PETANGO_URL =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals.aspx?" +
  "species=Cat&sex=A&agegroup=All&onhold=A&orderby=Random&colnum=3" +
  "&css=https://spcastjohns.org/wp-content/themes/prime/assets/css/adopt.css" +
  "&authkey=o8exmnumy8ij0fy3wsebhs082gj44ikqi13yq6b7bg4wcgrxgm" +
  "&detailsInPopup=Yes&featuredPet=Include&stageID=2";

const SPCA_AUTHKEY = "o8exmnumy8ij0fy3wsebhs082gj44ikqi13yq6b7bg4wcgrxgm";

const PETANGO_DETAILS_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx";

export class SpcaScraper implements Scraper {
  readonly source = "spca";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(PETANGO_URL, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      // Wait for results — SPCA may have zero cats available
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

          // Extract sex from combined "Female/Spayed" or "Male/Neutered"
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
          age: l.age,
          sex: l.sex,
          breed: l.breed,
          description: "",
          listingUrl: `${PETANGO_DETAILS_BASE}?id=${l.sourceId}&authkey=${SPCA_AUTHKEY}`,
        }));

      return { listings: results, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
