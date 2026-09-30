/**
 * Single source of truth for the five feeds/tabs, shared by the globe
 * (landing screen pins) and the tab nav — so their keys and labels can't
 * drift apart from each other.
 */
export type FeedKey = "apod" | "exoplanets" | "space-weather" | "iss" | "neows";

export interface FeedMeta {
  key: FeedKey;
  /** Short label for the tab bar. */
  navLabel: string;
  /** Fuller label for the globe pin's hover tooltip. */
  globeLabel: string;
  /** Arbitrary/decorative globe position — not tied to anything real. */
  lat: number;
  lng: number;
}

export const FEEDS: FeedMeta[] = [
  { key: "apod", navLabel: "APOD", globeLabel: "Astronomy Picture of the Day", lat: 35, lng: -95 },
  { key: "exoplanets", navLabel: "Exoplanets", globeLabel: "Exoplanets", lat: 8, lng: 50 },
  {
    key: "space-weather",
    navLabel: "Space Weather",
    globeLabel: "Space Weather",
    lat: -22,
    lng: 135,
  },
  { key: "iss", navLabel: "ISS Tracker", globeLabel: "ISS Tracker", lat: 52, lng: 10 },
  {
    key: "neows",
    navLabel: "Near-Earth Objects",
    globeLabel: "Near-Earth Objects",
    lat: -33,
    lng: -63,
  },
];