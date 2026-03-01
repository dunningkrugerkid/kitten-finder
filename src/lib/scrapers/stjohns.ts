import { chromium } from "playwright";
import type { NewCatListing } from "../types.js";
import type { Scraper, ScraperResult } from "./types.js";

/**
 * Direct Petango widget URL for cats at City of St. John's Animal Care.
 *
 * The main page (apps.stjohns.ca/petpoint/Adoptablepets.aspx) embeds this
 * in an iframe with id="catframe". We navigate directly to the iframe URL
 * to avoid dealing with cross-origin iframe access.
 */
const PETANGO_URL =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals.aspx?" +
  "species=Cat&sex=A&agegroup=All&location=&site=&onhold=N&orderby=ID&colnum=4" +
  "&css=https://ws.petango.com/WebServices/adoptablesearch/css/styles.css" +
  "&authkey=n564epb07r0g7lui0pf0cb3tidbr5bunroe2cisfbusbkqmvn7" +
  "&recAmount=&detailsInPopup=No&featuredPet=Include&stageID=";

const PETANGO_DETAILS_BASE =
  "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx";

export class StJohnsScraper implements Scraper {
  readonly source = "stjohns";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(PETANGO_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Wait for the results table to appear
      await page.waitForSelector("td.list-item", { timeout: 15_000 });

      const listings = await page.$$eval("td.list-item", (cells) => {
        return cells
          .map((cell) => {
            const name =
              cell.querySelector(".list-animal-name a")?.textContent?.trim() ??
              "";
            const sourceId =
              cell.querySelector(".list-animal-id")?.textContent?.trim() ?? "";
            const sexRaw =
              cell.querySelector(".list-animal-sexSN")?.textContent?.trim() ??
              "";
            const breed =
              cell.querySelector(".list-animal-breed")?.textContent?.trim() ??
              "";
            const age =
              cell.querySelector(".list-animal-age")?.textContent?.trim() ?? "";
            const photoUrl =
              cell.querySelector(".list-animal-photo")?.getAttribute("src") ??
              "";

            // Extract sex from combined "Female/Spayed" or "Male/Neutered"
            const sex = sexRaw.split("/")[0] || sexRaw;

            return { name, sourceId, sex, breed, age, photoUrl };
          })
          .filter((l) => l.sourceId !== "");
      });

      const results: NewCatListing[] = listings.map((l) => ({
        source: this.source,
        sourceId: l.sourceId,
        name: l.name,
        photoUrl: l.photoUrl,
        age: l.age,
        sex: l.sex,
        breed: l.breed,
        description: "",
        listingUrl: `${PETANGO_DETAILS_BASE}?id=${l.sourceId}`,
      }));

      return { listings: results, source: this.source };
    } finally {
      await browser.close();
    }
  }
}
