/**
 * Reads the current Astronomy Picture of the Day straight from NASA's new
 * APOD page (https://science.nasa.gov/apod/).
 *
 * Why this exists: APOD moved from apod.nasa.gov to science.nasa.gov, and
 * NASA's APOD API (api.nasa.gov/planetary/apod) stopped returning real
 * images — for every recent day it hands back the NASA logo. The page
 * itself is fine, so when the API's entry is unusable the route falls back
 * to this.
 *
 * This is HTML scraping, so it is inherently brittle: it depends on the
 * page's current markup, and will need updating if NASA redesigns it. It is
 * written to fail soft — `parseApodPage` returns null (never throws) when
 * the markup isn't what it expects, and the caller moves on to its next
 * fallback. Deliberately anchored on the hero block right around the title
 * heading, NOT on "the first image URL in the file": the page's <head>
 * metadata still points at a stale June image.
 */

import { isoDate } from "./nasaClient.js";

export interface ApodResponse {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
}

const APOD_PAGE_URL = "https://science.nasa.gov/apod/";
const PAGE_TIMEOUT_MS = 5000;

// Widest image we'll pick from the page's responsive `srcset` — plenty for
// a card, without downloading the multi-megabyte original.
const MAX_IMAGE_WIDTH = 1600;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/** "October 7, 2026" -> "2026-10-07"; null if it isn't in that shape. */
function parseLongDate(text: string): string | null {
  const m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (month === 0) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

/** Picks the widest srcset candidate not over MAX_IMAGE_WIDTH. */
function pickFromSrcset(srcset: string): string | null {
  const candidates: { url: string; width: number }[] = [];
  for (const m of srcset.matchAll(/(\S+)\s+(\d+)w/g)) {
    candidates.push({ url: decodeEntities(m[1]), width: Number(m[2]) });
  }
  if (candidates.length === 0) return null;
  const fitting = candidates.filter((c) => c.width <= MAX_IMAGE_WIDTH);
  const chosen =
    fitting.length > 0
      ? fitting.reduce((a, b) => (b.width > a.width ? b : a))
      : candidates.reduce((a, b) => (b.width < a.width ? b : a));
  return chosen.url;
}

/**
 * Pulls today's entry out of the APOD page HTML, or returns null if the
 * markup isn't what we expect. `fallbackDate` (YYYY-MM-DD) is used only if
 * the page's own date row can't be read.
 */
export function parseApodPage(html: string, fallbackDate?: string): ApodResponse | null {
  // The title heading, immediately followed by the hero's content row —
  // this pair is what pins us to the current picture's block.
  // The tempered group stops the match from running on from an earlier,
  // unrelated <h2> (the page has several) to reach this one.
  const titleMatch =
    /<h2[^>]*>((?:(?!<\/?h2)[\s\S])*)<\/h2>\s*<div[^>]*media-detail-hero__content-row/.exec(html);
  if (!titleMatch) return null;

  const title = textOf(titleMatch[1]);
  if (!title) return null;

  // The hero media sits in the <figure> just before the title.
  const beforeTitle = html.slice(0, titleMatch.index);
  const figureStart = beforeTitle.lastIndexOf("<figure");
  const mediaHtml = beforeTitle.slice(figureStart >= 0 ? figureStart : Math.max(0, beforeTitle.length - 4000));

  let mediaType: "image" | "video" = "image";
  let url: string | null = null;
  let hdurl: string | undefined;

  const srcset = /\ssrcset="([^"]+)"/.exec(mediaHtml);
  const imgSrc = /<img[^>]*\ssrc="([^"]+)"/.exec(mediaHtml);
  if (srcset || imgSrc) {
    url = (srcset && pickFromSrcset(srcset[1])) || (imgSrc ? decodeEntities(imgSrc[1]) : null);
    const link = /<a[^>]*\shref="([^"]+)"/.exec(mediaHtml);
    if (link && /^https:\/\/assets\.science\.nasa\.gov\//.test(decodeEntities(link[1]))) {
      hdurl = decodeEntities(link[1]);
    }
  } else {
    // Video days: an embedded player instead of an image.
    const iframe = /<iframe[^>]*\ssrc="([^"]+)"/.exec(mediaHtml);
    if (iframe) {
      mediaType = "video";
      url = decodeEntities(iframe[1]);
    }
  }
  if (!url) return null;

  const descMatch = /<p[^>]*media-detail-hero__description[^>]*>([\s\S]*?)<\/p>/.exec(html);
  const explanation = descMatch
    ? textOf(descMatch[1])
        .replace(/^Explanation:\s*/i, "")
        .replace(/\s*Tomorrow['\u2019]s picture:.*$/i, "")
        .trim()
    : "";

  // The metadata table: <th>Label</th><td>Value</td> rows.
  const rows = new Map<string, string>();
  for (const m of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    rows.set(textOf(m[1]).toLowerCase(), textOf(m[2]));
  }

  let date: string | null = null;
  for (const [label, value] of rows) {
    if (label.includes("date")) {
      date = parseLongDate(value);
      if (date) break;
    }
  }
  if (!date) {
    for (const value of rows.values()) {
      date = parseLongDate(value);
      if (date) break;
    }
  }

  let copyright: string | undefined;
  for (const [label, value] of rows) {
    if (label.includes("credit")) {
      copyright = value.slice(0, 200) || undefined;
      break;
    }
  }

  return {
    date: date ?? fallbackDate ?? isoDate(0),
    title,
    explanation,
    url,
    ...(hdurl ? { hdurl } : {}),
    media_type: mediaType,
    ...(copyright ? { copyright } : {}),
  };
}

/** Fetches the APOD page and parses it. Throws if the page can't be read. */
export async function fetchApodPage(fallbackDate?: string): Promise<ApodResponse> {
  const res = await fetch(APOD_PAGE_URL, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Skywatch/0.1)" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`APOD page request failed: ${res.status} ${res.statusText}`);
  }
  const parsed = parseApodPage(await res.text(), fallbackDate);
  if (!parsed) {
    throw new Error("APOD page markup not recognized (NASA may have changed it)");
  }
  return parsed;
}