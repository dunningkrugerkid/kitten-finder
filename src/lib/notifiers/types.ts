import type { CatListing } from "../types.js";

export interface Notifier {
  name: string;
  notify(listings: CatListing[]): Promise<void>;
}
