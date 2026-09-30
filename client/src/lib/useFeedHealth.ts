import { useEffect, useState } from "react";
import { api } from "./api";
import type { FeedKey } from "./feeds";

export type FeedStatus = "checking" | "ok" | "down";

const CHECKS: Record<FeedKey, () => Promise<unknown>> = {
  apod: () => api.getApod(),
  exoplanets: () => api.getExoplanets(),
  "space-weather": () => api.getSpaceWeather(),
  iss: () => api.getIssPosition(),
  neows: () => api.getNearEarthObjects(),
};

const INITIAL_STATUS: Record<FeedKey, FeedStatus> = {
  apod: "checking",
  exoplanets: "checking",
  "space-weather": "checking",
  iss: "checking",
  neows: "checking",
};

/**
 * Pings each feed's real endpoint once on mount so the globe can flag a
 * down feed before the visitor ever opens its tab, and so a broken tab can
 * show a plain failure message instead of mounting a component that's just
 * going to fail anyway. This reuses the exact same `api` calls each section
 * already makes, and the backend's own response cache means it doesn't cost
 * a second real NASA request when the tab is opened right after a healthy
 * check.
 */
export function useFeedHealth(): Record<FeedKey, FeedStatus> {
  const [status, setStatus] = useState<Record<FeedKey, FeedStatus>>(INITIAL_STATUS);

  useEffect(() => {
    let cancelled = false;

    (Object.keys(CHECKS) as FeedKey[]).forEach((key) => {
      CHECKS[key]()
        .then(() => {
          if (!cancelled) setStatus((prev) => ({ ...prev, [key]: "ok" }));
        })
        .catch(() => {
          if (!cancelled) setStatus((prev) => ({ ...prev, [key]: "down" }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}