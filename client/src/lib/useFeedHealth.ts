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

// A feed is only marked down after the first try plus these retries all fail
// — NASA's gateways throw the occasional one-off 503, and a single blip
// shouldn't turn a pin red for the whole visit.
const RETRY_DELAYS_MS = [1500, 4000];

// A feed that is down gets re-checked this often, so it recovers on its own
// instead of staying red until the page is reloaded. Deliberately gentle:
// each check is a real upstream request, and NASA's DEMO_KEY is capped at
// only a handful per hour.
const RECHECK_DOWN_MS = 5 * 60 * 1000;

/**
 * Pings each feed's real endpoint on mount so the globe can flag a down
 * feed before the visitor ever opens its tab, and so a broken tab can show
 * a plain failure message instead of mounting a component that's just going
 * to fail anyway. This reuses the exact same `api` calls each section
 * already makes, and the backend's own response cache means it doesn't cost
 * a second real NASA request when the tab is opened right after a healthy
 * check.
 *
 * Failed checks are retried a couple of times before a feed is marked down,
 * and down feeds are re-checked periodically.
 */
export function useFeedHealth(): Record<FeedKey, FeedStatus> {
  const [status, setStatus] = useState<Record<FeedKey, FeedStatus>>(INITIAL_STATUS);

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<number>();

    // Resolves after `ms`; if the hook unmounts first, the timer is cleared
    // and this simply never resolves (nothing is left waiting on it).
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    async function checkWithRetries(key: FeedKey): Promise<boolean> {
      for (let attempt = 0; ; attempt++) {
        try {
          await CHECKS[key]();
          return true;
        } catch {
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay === undefined || cancelled) return false;
          await wait(delay);
          if (cancelled) return false;
        }
      }
    }

    async function monitor(key: FeedKey) {
      while (!cancelled) {
        const ok = await checkWithRetries(key);
        if (cancelled) return;
        const next: FeedStatus = ok ? "ok" : "down";
        setStatus((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
        if (ok) return;
        await wait(RECHECK_DOWN_MS);
      }
    }

    (Object.keys(CHECKS) as FeedKey[]).forEach((key) => {
      void monitor(key);
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return status;
}