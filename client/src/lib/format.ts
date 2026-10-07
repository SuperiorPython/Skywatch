const PARSECS_TO_LIGHT_YEARS = 3.26156;

export function parsecsToLightYears(parsecs: number): number {
  return parsecs * PARSECS_TO_LIGHT_YEARS;
}

export function formatNumber(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

/** "YYYY-MM-DD" (UTC) for a Date, used as both bucket keys and lookup keys. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** e.g. "Sep 1", for axis ticks — parses a "YYYY-MM-DD" string as UTC. */
export function formatShortDay(isoDayStr: string): string {
  const d = new Date(`${isoDayStr}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    d
  );
}

/** e.g. "Sep 1, 2:24 PM", for the event feed. */
export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** Ascending array of "YYYY-MM-DD" strings for the last `days` days, ending today (UTC). */
export function lastNDays(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

const LUNAR_DISTANCE_KM = 384_400;

/** NEO close-approach distances are conventionally reported in lunar distances (LD). */
export function kmToLunarDistances(km: number): number {
  return km / LUNAR_DISTANCE_KM;
}

export function kphToKps(kph: number): number {
  return kph / 3600;
}