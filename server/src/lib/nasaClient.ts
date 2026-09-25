/**
 * Thin wrapper around fetch for api.nasa.gov endpoints, which all share the
 * same `api_key` query param convention. Endpoints that live outside
 * api.nasa.gov (the Exoplanet Archive TAP service, ISS location APIs) are
 * fetched directly in their own route files instead.
 */

const NASA_API_BASE = "https://api.nasa.gov";

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

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(
      `NASA API request to ${path} failed: ${res.status} ${res.statusText} ${body}`.trim(),
      res.status
    );
  }
  return (await res.json()) as T;
}

/** YYYY-MM-DD, in UTC, offset by `daysFromToday` (negative = past). */
export function isoDate(daysFromToday = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}
