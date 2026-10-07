import { Router } from "express";
import { fetchDonki, isoDate } from "../lib/nasaClient.js";
import { cached, TTL } from "../lib/cache.js";

export const donkiRouter = Router();

interface SolarFlare {
  flrID: string;
  beginTime: string;
  peakTime: string | null;
  classType: string | null;
  sourceLocation: string | null;
}

interface CoronalMassEjection {
  activityID: string;
  startTime: string;
  note: string | null;
}

interface GeomagneticStorm {
  gstID: string;
  startTime: string;
  allKpIndex?: { kpIndex: number; observedTime: string }[];
}

export type SpaceWeatherEvent = {
  id: string;
  type: "Solar Flare" | "CME" | "Geomagnetic Storm";
  time: string;
  headline: string;
};

/**
 * GET /api/space-weather?days=30
 * Merges DONKI's flare (FLR), CME, and geomagnetic storm (GST) feeds into
 * one timeline, most recent first. `days` is clamped to [1, 90].
 */
donkiRouter.get("/", async (req, res) => {
  const requested = Number(req.query.days);
  const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 90) : 30;
  const startDate = isoDate(-days);
  const endDate = isoDate(0);

  try {
    const events = await cached(`space-weather:${days}`, TTL.SIX_HOURS, async () => {
      const [flares, cmes, storms] = await Promise.all([
          fetchDonki<SolarFlare[]>("FLR", { startDate, endDate }),
          fetchDonki<CoronalMassEjection[]>("CME", { startDate, endDate }),
          fetchDonki<GeomagneticStorm[]>("GST", { startDate, endDate }),
      ]);

      const merged: SpaceWeatherEvent[] = [
        ...flares.map((f) => ({
          id: f.flrID,
          type: "Solar Flare" as const,
          time: f.peakTime ?? f.beginTime,
          headline: `${f.classType ?? "Unclassified"} flare${
            f.sourceLocation ? ` at ${f.sourceLocation}` : ""
          }`,
        })),
        ...cmes.map((c) => ({
          id: c.activityID,
          type: "CME" as const,
          time: c.startTime,
          headline: c.note?.slice(0, 140) || "Coronal mass ejection observed",
        })),
        ...storms.map((s) => {
          const maxKp = s.allKpIndex?.length
            ? Math.max(...s.allKpIndex.map((k) => k.kpIndex))
            : null;
          return {
            id: s.gstID,
            type: "Geomagnetic Storm" as const,
            time: s.startTime,
            headline: maxKp !== null ? `Peak Kp index ${maxKp}` : "Geomagnetic storm observed",
          };
        }),
      ];

      merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return merged;
    });

    res.json(events);
  } catch (err) {
    console.error("[space-weather]", err);
    res.status(502).json({ error: "Failed to fetch space weather data." });
  }
});
