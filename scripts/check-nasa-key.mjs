#!/usr/bin/env node
/**
 * Hits a lightweight api.nasa.gov endpoint with NASA_API_KEY and fails
 * (non-zero exit) if the key is missing, invalid, or rate-limited. Meant to
 * run both locally (`npm run check:nasa-key`, reading server/.env) and in
 * CI (GitHub Actions, reading the NASA_API_KEY repo secret) — see
 * .github/workflows/nasa-key-health.yml.
 *
 * APOD is used as the check target purely because it's the cheapest
 * possible authenticated call; the key isn't endpoint-specific, so a
 * passing APOD request means DONKI/NeoWs would work too.
 */

// Only meaningful for local runs — in CI, NASA_API_KEY is already set as an
// env var by the workflow, and this simply finds no server/.env to load.
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: new URL("../server/.env", import.meta.url) });
} catch {
  // dotenv not resolvable (e.g. a clean CI checkout with no npm install of
  // the server workspace) — fine, CI provides the env var directly.
}

const apiKey = process.env.NASA_API_KEY?.trim();

if (!apiKey || apiKey === "DEMO_KEY") {
  console.error(
    "NASA_API_KEY is not set (or is still DEMO_KEY) — set a real key in server/.env locally, " +
      "or as the NASA_API_KEY repository secret in CI."
  );
  process.exit(1);
}

const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
const res = await fetch(url);

const remaining = res.headers.get("x-ratelimit-remaining");
const limit = res.headers.get("x-ratelimit-limit");

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`NASA API check failed: ${res.status} ${res.statusText}\n${body}`.trim());
  await writeSummary(`### NASA API key health\n\n- Status: ❌ FAILED (${res.status})\n`);
  process.exit(1);
}

console.log(
  `NASA API key OK. Rate limit remaining: ${remaining ?? "unknown"} of ${limit ?? "unknown"} per hour.`
);

await writeSummary(
  `### NASA API key health\n\n- Status: ✅ OK\n- Rate limit remaining: ${
    remaining ?? "unknown"
  } / ${limit ?? "unknown"} per hour\n`
);

/** Appends to the GitHub Actions job summary when running in CI; no-op locally. */
async function writeSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const fs = await import("node:fs/promises");
  await fs.appendFile(summaryPath, markdown);
}