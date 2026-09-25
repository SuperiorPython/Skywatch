import { Router } from "express";
import { fetchNasa, isoDate } from "../lib/nasaClient.js";
import { cached, TTL } from "../lib/cache.js";

export const neowsRouter = Router();

interface RawNeo {
  id: string;
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    kilometers: { estimated_diameter_min: number; estimated_diameter_max: number };
  };
  close_approach_data: {
    close_approach_date: string;
    relative_velocity: { kilometers_per_hour: string };
    miss_distance: { kilometers: string };
  }[];
}

interface RawNeoFeedResponse {
  near_earth_objects: Record<string, RawNeo[]>;
}

export interface CloseApproach {
  id: string;
  name: string;
  isHazardous: boolean;
  date: string;
  diameterKmMin: number;
  diameterKmMax: number;
  velocityKph: number;
  missDistanceKm: number;
}

/**
 * GET /api/near-earth-objects
 * NASA's feed endpoint caps date ranges at 7 days, so this always returns
 * "the next 7 days from today," flattened into one sorted list (soonest
 * approach first).
 */
neowsRouter.get("/", async (_req, res) => {
  const startDate = isoDate(0);
  const endDate = isoDate(7);

  try {
    const approaches = await cached("neows", TTL.SIX_HOURS, async () => {
      const data = await fetchNasa<RawNeoFeedResponse>("/neo/rest/v1/feed", {
        start_date: startDate,
        end_date: endDate,
      });

      const flattened: CloseApproach[] = Object.values(data.near_earth_objects)
        .flat()
        .flatMap((neo) =>
          neo.close_approach_data.map((approach) => ({
            id: neo.id,
            name: neo.name,
            isHazardous: neo.is_potentially_hazardous_asteroid,
            date: approach.close_approach_date,
            diameterKmMin: neo.estimated_diameter.kilometers.estimated_diameter_min,
            diameterKmMax: neo.estimated_diameter.kilometers.estimated_diameter_max,
            velocityKph: Number(approach.relative_velocity.kilometers_per_hour),
            missDistanceKm: Number(approach.miss_distance.kilometers),
          }))
        );

      flattened.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return flattened;
    });

    res.json(approaches);
  } catch (err) {
    console.error("[near-earth-objects]", err);
    res.status(502).json({ error: "Failed to fetch near-Earth object data." });
  }
});
