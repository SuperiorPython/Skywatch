/**
 * Thin wrappers around fetch for NASA data sources.
 *
 * - `fetchNasa` is for api.nasa.gov endpoints, which all share the same
 *   `api_key` query param convention.
 * - `fetchDonki` is for the DONKI space-weather API, which NASA moved off
 *   api.nasa.gov (the old /DONKI/* paths now 301-redirect to an HTML news
 *   page) onto its own CCMC host, with no API key.
 *
 * Endpoints that live elsewhere entirely (the Exoplanet Archive TAP
 * service, ISS location APIs) are fetched directly in their own route files.
 */

const NASA_API_BASE = "https://api.nasa.gov";
const DONKI_API_BASE = "https://ccmc.gsfc.nasa.gov/DONKI-API/get";

// NASA's gateways return the odd transient 503 or HTML error page. A couple
// of quick retries absorbs those instead of surfacing them as a broken
// feed. Attempts are kept short because a Netlify Function's default limit
// is ~10s: even if every attempt hangs, 3 x 2.8s plus the 1s of delays is
// ~9.4s, so the function still answers (with a clean 502) instead of being
// killed mid-request.
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 2800;
const RETRY_DELAYS_MS = [300, 700];

export function getNasaApiKey(): string {
  return process.env.NASA_API_KEY?.trim() || "DEMO_KEY";
}

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** host + path only — never the query string, which can carry the API key. */
function safeLocation(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.host}${u.pathname}`;
  } catch {
    return "unknown URL";
  }
}

/**
 * GETs a URL and parses it as JSON, retrying transient failures (network
 * errors, timeouts, 5xx, and non-JSON bodies such as HTML error pages or
 * redirects to a news page). 4xx responses (bad request, rate limit) are
 * not retried — they won't fix themselves in a few hundred milliseconds.
 *
 * `label` is used in error messages; it must not contain the API key.
 */
export async function fetchJson<T>(url: string, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      const body = await res.text();

      if (!res.ok) {
        throw new UpstreamError(
          `${label} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`.trim(),
          res.status
        );
      }

      try {
        return JSON.parse(body) as T;
      } catch {
        throw new UpstreamError(
          `${label} returned non-JSON (status ${res.status}${
            res.redirected ? `, redirected to ${safeLocation(res.url)}` : ""
          }): ${body.slice(0, 120)}`,
          502
        );
      }
    } catch (err) {
      lastError = err;
      const isClientError =
        err instanceof UpstreamError && err.status >= 400 && err.status < 500;
      if (isClientError || attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 700);
    }
  }

  throw lastError;
}

export async function fetchNasa<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(NASA_API_BASE + path);
  url.searchParams.set("api_key", getNasaApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return fetchJson<T>(url.toString(), `NASA API request to ${path}`);
}

export type DonkiEventType = "FLR" | "CME" | "GST";

/** DONKI at its new home — same params and response shapes, no API key. */
export async function fetchDonki<T>(
  type: DonkiEventType,
  params: { startDate: string; endDate: string }
): Promise<T> {
  const url = new URL(`${DONKI_API_BASE}/${type}`);
  url.searchParams.set("startDate", params.startDate);
  url.searchParams.set("endDate", params.endDate);
  return fetchJson<T>(url.toString(), `DONKI ${type} request`);
}

/** YYYY-MM-DD, in UTC, offset by `daysFromToday` (negative = past). */
export function isoDate(daysFromToday = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}