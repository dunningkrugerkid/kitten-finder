import type { ShelterConfig } from "./src/lib/config.js";

const shelters: ShelterConfig[] = [
  {
    type: "petango",
    name: "SPCA St. John's",
    key: "spca",
    authKey: "o8exmnumy8ij0fy3wsebhs082gj44ikqi13yq6b7bg4wcgrxgm",
    color: "#2ECC71",
    cssUrl:
      "https://spcastjohns.org/wp-content/themes/prime/assets/css/adopt.css",
    detailsInPopup: true,
  },
  {
    type: "petango",
    name: "City of St. John's",
    key: "stjohns",
    authKey: "n564epb07r0g7lui0pf0cb3tidbr5bunroe2cisfbusbkqmvn7",
    color: "#3498DB",
  },
  {
    type: "custom",
    name: "Heavenly Creatures",
    key: "heavenly",
    color: "#9B59B6",
    scraperPath: "./src/lib/scrapers/heavenly.ts",
  },
];

export default shelters;
