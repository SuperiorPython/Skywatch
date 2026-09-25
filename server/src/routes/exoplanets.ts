import { Router } from "express";
import { cached, TTL } from "../lib/cache.js";

export const exoplanetsRouter = Router();

// The Exoplanet Archive's Table Access Protocol (TAP) service is separate
// from api.nasa.gov and does not require an API key.
// Docs: https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
const TAP_BASE = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

export interface ExoplanetRow {
  pl_name: string;
  hostname: string;
  disc_year: number | null;
  discoverymethod: string | null;
  pl_rade: number | null; // radius, Earth radii
  pl_bmasse: number | null; // mass, Earth masses
  sy_dist: number | null; // distance from Earth, parsecs
}

/**
 * GET /api/exoplanets
 * Returns up to 1000 confirmed planets (one row per system's default
 * parameter set) with the fields the frontend needs for the table and
 * scatter plot. Rows missing both distance and radius are filtered out
 * server-side since they're useless for the "distance vs. radius" chart.
 */
exoplanetsRouter.get("/", async (_req, res) => {
  const query =
    "select top 1000 pl_name, hostname, disc_year, discoverymethod, pl_rade, pl_bmasse, sy_dist " +
    "from pscomppars " +
    "where sy_dist is not null and pl_rade is not null " +
    "order by disc_year desc";

  const url = new URL(TAP_BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  try {
    const data = await cached("exoplanets", TTL.ONE_DAY, async () => {
      const upstream = await fetch(url.toString());
      if (!upstream.ok) {
        throw new Error(`Exoplanet Archive request failed: ${upstream.status}`);
      }
      return (await upstream.json()) as ExoplanetRow[];
    });
    res.json(data);
  } catch (err) {
    console.error("[exoplanets]", err);
    res.status(502).json({ error: "Failed to fetch exoplanet data." });
  }
});
