---
id: architecture-db
title: Drizzle ORM + Postgres (`@workspace/db`)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [db]
related:
  - ./api-server.md
source-of-truth-files:
  - lib/db/package.json
  - lib/db/tsconfig.json
  - lib/db/drizzle.config.ts
  - lib/db/src/index.ts
  - lib/db/src/schema/
---

# Drizzle ORM + Postgres (`@workspace/db`)

## Purpose
PostgreSQL data layer for the API server. Schema declared in TypeScript via
Drizzle ORM; `drizzle-zod` produces matching Zod schemas where useful.

## Entry points
- [src/index.ts](../../../lib/db/src/index.ts) — public exports (client + schema).
- [src/schema/](../../../lib/db/src/schema/) — table definitions.
- [drizzle.config.ts](../../../lib/db/drizzle.config.ts) — drizzle-kit config
  for `push` / `generate` commands.

## Dev commands
```bash
pnpm --filter @workspace/db run push    # push schema changes to dev DB
```
Production migrations should be generated and reviewed before deploy, not
pushed.

## Consumers
- [api-server](./api-server.md).

## Known gotchas
- `push` rewrites the dev database to match the current TypeScript schema with
  no migration history — **never** run against a non-dev environment.
- The Financial Clarity app does **not** consume this package; it is
  localStorage-only.
