# Skywatch

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

## Getting started

You'll need a free NASA API key from https://api.nasa.gov/ (instant signup,
no approval wait). Without one, the app falls back to `DEMO_KEY`, which is
capped at 30 requests/hour and 50/day — fine for a quick look, not for real
use.

```bash
# 1. Install dependencies (run once, from the repo root)
npm install

# 2. Configure your NASA API key
cp server/.env.example server/.env
# then edit server/.env and set NASA_API_KEY=your_key_here

# 3. Run both the backend and frontend in dev mode
npm run dev
```

The backend runs on http://localhost:8787 and the frontend dev server on
http://localhost:5173 (Vite proxies `/api` requests to the backend — see
`client/vite.config.ts`).

## Notes

- The backend caches each NASA endpoint response in memory for a short TTL
  so the dashboard doesn't burn through the rate limit on every page
  refresh (see `server/src/lib/cache.ts`).
- This project intentionally skips Streamlit/Altair (used in
  [Playlist-DNA-App](https://github.com/SuperiorPython/Playlist-DNA-App)) in
  favor of a hand-built React frontend.
