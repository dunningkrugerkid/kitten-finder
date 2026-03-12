import type { APIRoute } from "astro";
import { loadConfig } from "../../lib/config.js";

const config = await loadConfig();

export const GET: APIRoute = () => {
  const shelters = config.shelters.map((s) => ({
    key: s.key,
    name: s.name,
    color: s.color,
  }));

  return new Response(JSON.stringify(shelters), {
    headers: { "Content-Type": "application/json" },
  });
};
