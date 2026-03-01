import type { APIRoute } from "astro";
import { createDb, getActiveListings } from "../../lib/db";

const db = createDb(process.env.DB_PATH || undefined);

export const GET: APIRoute = ({ url }) => {
  const source = url.searchParams.get("source") || undefined;
  const sex = url.searchParams.get("sex") || undefined;
  const age = url.searchParams.get("age") || undefined;

  const listings = getActiveListings(db, { source, sex, age });
  return new Response(JSON.stringify(listings), {
    headers: { "Content-Type": "application/json" },
  });
};
