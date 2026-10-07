import express from "express";
import cors from "cors";
import { apodRouter } from "./routes/apod.js";
import { exoplanetsRouter } from "./routes/exoplanets.js";
import { donkiRouter } from "./routes/donki.js";
import { issRouter } from "./routes/iss.js";
import { neowsRouter } from "./routes/neows.js";
import { getNasaApiKey } from "./lib/nasaClient.js";

/**
 * Builds the Express app without starting a listener. Split out of
 * index.ts so the same app can run two ways: `index.ts` calls
 * `app.listen(...)` for local dev, and the Netlify function
 * (netlify/functions/api.ts) wraps this same app with serverless-http
 * instead — no route logic is duplicated between the two.
 */
export function createApp() {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  app.use(cors({ origin: clientOrigin }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, usingDemoKey: getNasaApiKey() === "DEMO_KEY" });
  });

  app.use("/api/apod", apodRouter);
  app.use("/api/exoplanets", exoplanetsRouter);
  app.use("/api/space-weather", donkiRouter);
  app.use("/api/iss", issRouter);
  app.use("/api/near-earth-objects", neowsRouter);

  return app;
}