import { Router } from "express";
import { fetchNasa } from "../lib/nasaClient.js";
import { cached, TTL } from "../lib/cache.js";

export const apodRouter = Router();

interface ApodResponse {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
}

/**
 * GET /api/apod?date=YYYY-MM-DD
 * Defaults to today. APOD only publishes one image per day, so a full-day
 * cache is safe.
 */
apodRouter.get("/", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  const cacheKey = `apod:${date ?? "today"}`;

  try {
    const data = await cached(cacheKey, TTL.ONE_DAY, () =>
      fetchNasa<ApodResponse>("/planetary/apod", { date })
    );
    res.json(data);
  } catch (err) {
    console.error("[apod]", err);
    res.status(502).json({ error: "Failed to fetch Astronomy Picture of the Day." });
  }
});
