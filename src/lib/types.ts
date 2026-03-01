export interface CatListing {
  id: string;
  source: string;
  sourceId: string;
  name: string;
  photoUrl: string;
  age: string;
  sex: string;
  breed: string;
  description: string;
  listingUrl: string;
  firstSeen: string;
  lastSeen: string;
  isActive: number;
}

export type NewCatListing = Omit<
  CatListing,
  "id" | "firstSeen" | "lastSeen" | "isActive"
>;
