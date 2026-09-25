import serverless from "serverless-http";
import { createApp } from "../../server/src/app.js";

// Netlify's esbuild function bundler pulls in server/src/app.ts (and
// everything it imports) directly from TypeScript source at build time —
// no separate build step for the backend, and no route logic duplicated
// between local dev (server/src/index.ts) and this deployment target.
const rawHandler = serverless(createApp());

// The redirect in netlify.toml sends /api/* here, but the event Netlify
// hands the function still carries the full resolved path
// (/.netlify/functions/api/...) rather than the original /api/... path.
// Rewrite it back so Express's own routes (mounted at /api/apod, etc. in
// app.ts) match, instead of duplicating those routes without the prefix.
const FUNCTION_PREFIX = "/.netlify/functions/api";

// Loosely typed (not `@netlify/functions`'s Handler type) to avoid an
// extra dependency just for this one file's types — the shape is the
// standard Lambda-style (event, context) object serverless-http expects.
export const handler = async (event: { path?: string }, context: unknown) => {
  if (typeof event.path === "string" && event.path.startsWith(FUNCTION_PREFIX)) {
    event.path = "/api" + event.path.slice(FUNCTION_PREFIX.length);
  }
  return rawHandler(event as never, context as never);
};