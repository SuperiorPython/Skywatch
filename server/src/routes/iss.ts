import { Router } from "express";
import { cached, TTL } from "../lib/cache.js";

export const issRouter = Router();

export interface IssPosition {
  latitude: number;
  longitude: number;
  timestamp: number; // unix seconds
}

/**
 * The ISS's current position isn't a NASA-hosted API. open-notify.org is
 * the commonly used one but has had spotty uptime historically, so this
 * falls back to wheretheiss.at if the primary fails.
 */
async function fetchFromOpenNotify(): Promise<IssPosition> {
  const res = await fetch("http://api.open-notify.org/iss-now.json");
  if (!res.ok) throw new Error(`open-notify failed: ${res.status}`);
  const data = (await res.json()) as {
    iss_position: { latitude: string; longitude: string };
    timestamp: number;
  };
  return {
    latitude: Number(data.iss_position.latitude),
    longitude: Number(data.iss_position.longitude),
    timestamp: data.timestamp,
  };
}

async function fetchFromWhereTheIss(): Promise<IssPosition> {
  const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
  if (!res.ok) throw new Error(`wheretheiss.at failed: ${res.status}`);
  const data = (await res.json()) as {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  return { latitude: data.latitude, longitude: data.longitude, timestamp: data.timestamp };
}

/**
 * GET /api/iss
 * Short cache TTL since the whole point is that this is close to
 * real-time — the ISS moves at ~7.66 km/s, so anything longer than
 * ~30s starts looking stale on a map.
 */
issRouter.get("/", async (_req, res) => {
  try {
    const position = await cached("iss-position", TTL.THIRTY_SECONDS, async () => {
      try {
        return await fetchFromOpenNotify();
      } catch {
        return await fetchFromWhereTheIss();
      }
    });
    res.json(position);
  } catch (err) {
    console.error("[iss]", err);
    res.status(502).json({ error: "Failed to fetch ISS position." });
  }
});
