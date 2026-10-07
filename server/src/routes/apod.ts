import { Router } from "express";
import { fetchNasa, isoDate } from "../lib/nasaClient.js";
import { cached, TTL } from "../lib/cache.js";
import { fetchApodPage, type ApodResponse } from "../lib/apodPage.js";

export const apodRouter = Router();

// How many earlier days to try when today's entry is unusable.
const MAX_FALLBACK_DAYS = 3;

/**
 * NASA occasionally publishes an APOD entry whose image is just the NASA
 * logo (with a generic title like "NASA Science" and an explanation that
 * belongs to a different picture). That's upstream data, but showing it
 * means a visibly wrong image — so an entry like that is treated as
 * unusable. Videos are always accepted; their `url` is an embed link.
 */
function isUsable(apod: ApodResponse): boolean {
  if (apod.media_type === "video") return true;
  return typeof apod.url === "string" && apod.url !== "" && !/nasa-logo/i.test(apod.url);
}

/**
 * Today's APOD. If NASA's API entry for today is missing, failed to load,
 * or is one of the logo placeholders above, the real picture is read
 * straight from NASA's APOD page instead (see lib/apodPage.ts). Only if
 * that fails too does this fall back to the most recent usable API entry
 * from the last few days. The picture's own `date` field is returned
 * as-is, so the card honestly shows which day it is from.
 *
 * Each day is cached on its own: past days never change (a full day is
 * safe), while today's is re-checked hourly so a fixed entry shows up
 * without waiting for tomorrow.
 */
async function getUsableApod(): Promise<ApodResponse> {
  let lastError: unknown = new Error("No usable APOD entry found.");

  for (let daysBack = 0; daysBack <= MAX_FALLBACK_DAYS; daysBack++) {
    const date = isoDate(-daysBack);
    try {
      const apod = await cached(
        `apod:${date}`,
        daysBack === 0 ? TTL.ONE_HOUR : TTL.ONE_DAY,
        () => fetchNasa<ApodResponse>("/planetary/apod", { date })
      );
      if (isUsable(apod)) return apod;
      console.warn(`[apod] entry for ${date} is a placeholder; trying an earlier day`);
    } catch (err) {
      lastError = err;
      console.warn(`[apod] could not load ${date}; trying an earlier day`, err);
    }

    if (daysBack === 0) {
      try {
        return await cached("apod:page", TTL.ONE_HOUR, () => fetchApodPage(date));
      } catch (err) {
        lastError = err;
        console.warn("[apod] could not read NASA's APOD page; trying earlier days", err);
      }
    }
  }

  throw lastError;
}

/**
 * GET /api/apod?date=YYYY-MM-DD
 * Without a date: today's picture, falling back to a recent usable one (see
 * above). With a date: exactly that day, as NASA returns it.
 */
apodRouter.get("/", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;

  try {
    const data = date
      ? await cached(`apod:${date}`, TTL.ONE_DAY, () =>
          fetchNasa<ApodResponse>("/planetary/apod", { date })
        )
      : await getUsableApod();
    res.json(data);
  } catch (err) {
    console.error("[apod]", err);
    res.status(502).json({ error: "Failed to fetch Astronomy Picture of the Day." });
  }
});