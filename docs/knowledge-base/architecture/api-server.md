---
id: architecture-api-server
title: API server (`@workspace/api-server`)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [api-server]
related:
  - ./workspace.md
  - ./api-spec.md
  - ./db.md
source-of-truth-files:
  - artifacts/api-server/package.json
  - artifacts/api-server/build.mjs
  - artifacts/api-server/tsconfig.json
  - artifacts/api-server/src/index.ts
  - artifacts/api-server/src/app.ts
  - artifacts/api-server/src/routes/index.ts
  - artifacts/api-server/src/routes/health.ts
  - artifacts/api-server/src/lib/logger.ts
---

# API server (`@workspace/api-server`)

## Purpose
Express 5 HTTP server. Bundled to a single CJS file via esbuild for deployment.
Backbone for any future server-backed features; currently exposes a health
endpoint and the router scaffold.

## Entry points
- [src/index.ts](../../../artifacts/api-server/src/index.ts) — process entry;
  starts the HTTP listener.
- [src/app.ts](../../../artifacts/api-server/src/app.ts) — Express app factory
  (middleware + router wiring).
- [src/routes/index.ts](../../../artifacts/api-server/src/routes/index.ts) —
  top-level router mounting all route modules.

## Internal layout
- `src/lib/` — cross-cutting helpers (logger).
- `src/middlewares/` — Express middlewares.
- `src/routes/` — one file per route group (currently: `health.ts`).

## Build
- [build.mjs](../../../artifacts/api-server/build.mjs) — esbuild script
  producing a CJS bundle for deployment.
- Run via the package's `build` script (executed by the root `pnpm run build`).

## Dependencies
- Consumes: [lib/db](../../../lib/db/) (Drizzle / Postgres), [lib/api-zod](../../../lib/api-zod/)
  (request/response validation), [lib/api-spec](../../../lib/api-spec/) (contract source).
- Consumed by: none directly inside the workspace; deployed independently.

## Known gotchas
- Express 5 has stricter async error handling than Express 4 — any new route
  must return a Promise or call `next(err)` rather than throwing.
