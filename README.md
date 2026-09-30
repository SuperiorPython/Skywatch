# Skywatch

**Live demo:** [orbital-skywatch.netlify.app](https://orbital-skywatch.netlify.app/)

An interactive space dashboard built on NASA's public APIs, with a React +
TypeScript frontend (not another Streamlit app) and a small Express backend
that proxies and caches NASA API calls.

## Sections

- **APOD** — Astronomy Picture of the Day, hero section
- **Exoplanets** — filterable/sortable table + scatter plot from the NASA
  Exoplanet Archive (distance, radius, discovery method/year)
- **Space weather (DONKI)** — timeline of recent solar flares, CMEs, and
  geomagnetic storms
- **ISS tracker** — live map of the ISS's current position
- **Near-Earth objects (NeoWs)** — upcoming asteroid close approaches,
  sortable by size/distance/date

## Project layout

```
skywatch/
  client/   Vite + React + TypeScript frontend
  server/   Express + TypeScript backend (NASA API proxy + cache)
```

## Deploying to Netlify

Netlify hosts the built frontend as a static site and runs the Express
backend as a single serverless function (`netlify/functions/api.ts`, wired
up via `netlify.toml`) — no separate server to manage. The client's `/api/...`
fetches work unchanged in production; Netlify redirects them to the
function.

1. Push this repo to GitHub if it isn't already there.
2. On [netlify.com](https://app.netlify.com), **Add new site → Import an
   existing project**, and pick this repo. Netlify reads `netlify.toml`
   automatically, so the build command and publish directory are already
   set — you shouldn't need to type anything into those fields.
3. Before the first deploy (or right after, then redeploy), add your NASA
   key: **Site configuration → Environment variables → Add a variable** →
   name `NASA_API_KEY`, value your real key. This is separate from both
   `server/.env` and the `NASA_API_KEY` GitHub Actions secret — all three
   are independent copies of the same key.
4. Deploy. Netlify gives you a `https://<something>.netlify.app` URL —
   open it and the whole dashboard should work. (This project's own
   deploy lives at
   [orbital-skywatch.netlify.app](https://orbital-skywatch.netlify.app/).)

Prefer a one-off deploy without connecting GitHub at all? The
[Netlify CLI](https://docs.netlify.com/cli/get-started/) supports that
too: `npm install -g netlify-cli`, then `netlify deploy --prod` from the
repo root (after `netlify login` and `netlify init`).

A couple of things that are different in this deployment vs. local dev:
the in-memory response cache (`server/src/lib/cache.ts`) only survives
between requests when Netlify happens to reuse a "warm" function
container — a cold start clears it, so don't be surprised by an
occasional slower first load. And `CLIENT_ORIGIN` (used for CORS
locally) doesn't need to be set on Netlify, since the frontend and the
function are served from the same domain there.

## CI: weekly NASA API key health check

`.github/workflows/nasa-key-health.yml` hits `api.nasa.gov` every Monday and
fails the run (which GitHub emails you about by default) if the key is
missing, invalid, or rate-limited — catching a dead key before you go to
demo this instead of during. It can also be triggered manually from the
Actions tab.

To enable it, add your NASA API key as a repository secret named
`NASA_API_KEY`: repo **Settings → Secrets and variables → Actions → New
repository secret**. This is separate from `server/.env` — the workflow
never reads your local `.env` file.

You can run the same check locally (reads `server/.env`):

```bash
npm run check:nasa-key
```

## Notes

- The backend caches each NASA endpoint response in memory for a short TTL
  so the dashboard doesn't burn through the rate limit on every page
  refresh (see `server/src/lib/cache.ts`).
- The ISS tracker resets its trail whenever the gap between two readings is
  much larger than the poll interval (e.g. the tab was backgrounded and the
  browser throttled its timer) instead of drawing a straight line across the
  globe between two unrelated positions.
