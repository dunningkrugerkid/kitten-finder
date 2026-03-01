import { chromium } from "playwright";
import type { NewCatListing } from "../types.js";
import type { Scraper, ScraperResult } from "./types.js";

const HEAVENLY_URL = "https://heavenlycreatures.ca/adoptions/available-cats/";

export class HeavenlyScraper implements Scraper {
  readonly source = "heavenly";

  async scrape(): Promise<ScraperResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(HEAVENLY_URL, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      // The available cats page is a WordPress page where content is managed
      // via the WordPress editor. Cat listings appear inside div.post-content
      // as HTML blocks (headings, images, paragraphs). When no cats are
      // available, the div is empty.
      //
      // Observed DOM structure (from live site inspection):
      //   div.holder
      //     div.container
      //       div.box-holder-inner
      //         div.title.text-center > h3  ("Available Cats")
      //         div.post-content
      //           ... WordPress editor HTML with cat entries ...
      //
      // Each cat entry in the WordPress content typically contains:
      //   - An <img> element with the cat photo
      //   - A heading (<h4>, <h3>, <strong>) with the cat name
      //   - Paragraph text with details (age, sex, breed, description)

      // Wait briefly for any remaining JS rendering
      await page.waitForTimeout(2000);

      const listings = await page.evaluate(() => {
        const content = document.querySelector(".post-content");
        if (!content || !content.innerHTML.trim()) {
          return [];
        }

        // Strategy: Parse cat entries from WordPress editor content.
        // The content is free-form HTML authored in the WP editor.
        // We look for images paired with text blocks to identify cat entries.
        //
        // Common patterns in WordPress shelter pages:
        // 1) Each cat has an image followed by text with name/details
        // 2) Cats may be separated by <hr>, headings, or spacing
        // 3) Details often include name in bold/heading, then attributes in paragraphs

        const images = content.querySelectorAll("img");
        const entries: Array<{
          name: string;
          photoUrl: string;
          description: string;
          listingUrl: string;
        }> = [];

        if (images.length > 0) {
          // Strategy A: Image-based parsing
          // Each image likely represents a cat. We gather the surrounding
          // text to extract name and description.
          for (const img of images) {
            const photoUrl = img.getAttribute("src") || "";
            if (!photoUrl) continue;

            // Look for the cat name: check the alt attribute, nearby heading,
            // or the nearest bold/strong text
            let name = img.getAttribute("alt")?.trim() || "";

            // Walk up to find the containing block, then look for headings or
            // bold text near this image
            const parent =
              img.closest("div, figure, p, td") || img.parentElement;
            if (!name && parent) {
              const heading = parent.querySelector(
                "h1, h2, h3, h4, h5, h6, strong, b",
              );
              if (heading) {
                name = heading.textContent?.trim() || "";
              }
            }

            // If still no name, check the next sibling elements
            if (!name) {
              let sibling = (parent || img).nextElementSibling;
              while (sibling && !name) {
                const headingEl = sibling.matches("h1,h2,h3,h4,h5,h6,strong,b")
                  ? sibling
                  : sibling.querySelector("h1,h2,h3,h4,h5,h6,strong,b");
                if (headingEl) {
                  name = headingEl.textContent?.trim() || "";
                }
                sibling = sibling.nextElementSibling;
              }
            }

            // Also check the previous sibling for the name (name might come
            // before the image)
            if (!name) {
              let sibling = (parent || img).previousElementSibling;
              while (sibling && !name) {
                const headingEl = sibling.matches("h1,h2,h3,h4,h5,h6,strong,b")
                  ? sibling
                  : sibling.querySelector("h1,h2,h3,h4,h5,h6,strong,b");
                if (headingEl) {
                  name = headingEl.textContent?.trim() || "";
                }
                sibling = sibling.previousElementSibling;
              }
            }

            // Gather description from surrounding text
            let description = "";
            let descSibling = (parent || img).nextElementSibling;
            const descParts: string[] = [];
            let limit = 5; // Look at up to 5 following elements
            while (descSibling && limit > 0) {
              // Stop if we hit another image (next cat entry)
              if (
                descSibling.querySelector("img") ||
                descSibling.tagName === "IMG"
              ) {
                break;
              }
              // Stop if we hit an <hr> separator
              if (descSibling.tagName === "HR") break;

              const text = descSibling.textContent?.trim();
              if (text) descParts.push(text);
              descSibling = descSibling.nextElementSibling;
              limit--;
            }
            description = descParts.join(" ").substring(0, 500);

            // Check for a link wrapping the image or nearby
            let listingUrl = "";
            const linkParent = img.closest("a");
            if (linkParent) {
              listingUrl = linkParent.href;
            }

            if (name || photoUrl) {
              entries.push({
                name: name || "Unknown",
                photoUrl,
                description,
                listingUrl,
              });
            }
          }
        } else {
          // Strategy B: No images found. Look for text-only entries.
          // Parse headings or bold text as cat names with following text as
          // descriptions.
          const headings = content.querySelectorAll(
            "h1, h2, h3, h4, h5, h6, strong, b",
          );
          for (const heading of headings) {
            const name = heading.textContent?.trim() || "";
            if (!name) continue;

            // Skip generic headings
            const lower = name.toLowerCase();
            if (
              lower.includes("available") ||
              lower.includes("adopt") ||
              lower.includes("contact") ||
              lower.includes("dogs in need")
            ) {
              continue;
            }

            let description = "";
            const descParts: string[] = [];
            let sibling = (heading.closest("p, div") || heading)
              .nextElementSibling;
            let limit = 5;
            while (sibling && limit > 0) {
              if (
                sibling.matches("h1,h2,h3,h4,h5,h6") ||
                sibling.querySelector("h1,h2,h3,h4,h5,h6") ||
                sibling.tagName === "HR"
              ) {
                break;
              }
              const text = sibling.textContent?.trim();
              if (text) descParts.push(text);
              sibling = sibling.nextElementSibling;
              limit--;
            }
            description = descParts.join(" ").substring(0, 500);

            entries.push({
              name,
              photoUrl: "",
              description,
              listingUrl: "",
            });
          }
        }

        return entries;
      });

      // Parse structured fields from descriptions where possible
      const results: NewCatListing[] = listings.map((entry, index) => {
        const parsed = parseDetails(entry.description);
        return {
          source: this.source,
          sourceId: `heavenly-${slugify(entry.name)}-${index}`,
          name: entry.name,
          photoUrl: entry.photoUrl,
          age: parsed.age,
          sex: parsed.sex,
          breed: parsed.breed,
          description: parsed.description || entry.description,
          listingUrl: entry.listingUrl || HEAVENLY_URL,
        };
      });

      return { listings: results, source: this.source };
    } finally {
      await browser.close();
    }
  }
}

/**
 * Attempt to extract age, sex, breed from a freeform description string.
 * Shelter descriptions often include these details inline.
 */
function parseDetails(text: string): {
  age: string;
  sex: string;
  breed: string;
  description: string;
} {
  let age = "";
  let sex = "";
  let breed = "";
  let description = text;

  // Match age patterns: "2 years old", "8 months", "1 year", "kitten", "senior"
  const ageMatch = text.match(
    /(\d+\s*(?:year|yr|month|mo|week|wk)s?\s*(?:old)?|kitten|senior|adult|young)/i,
  );
  if (ageMatch) {
    age = ageMatch[1].trim();
  }

  // Match sex patterns: "male", "female", "neutered male", "spayed female"
  const sexMatch = text.match(
    /\b((?:neutered\s+|spayed\s+)?(?:male|female))\b/i,
  );
  if (sexMatch) {
    sex = sexMatch[1].trim();
  }

  // Match common breed mentions
  const breedMatch = text.match(
    /\b(domestic\s+(?:short|medium|long)\s*hair|tabby|siamese|persian|calico|tuxedo|orange tabby|maine coon|ragdoll|bengal|sphynx|russian blue|british shorthair|mixed breed)\b/i,
  );
  if (breedMatch) {
    breed = breedMatch[1].trim();
  }

  return { age, sex, breed, description };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
