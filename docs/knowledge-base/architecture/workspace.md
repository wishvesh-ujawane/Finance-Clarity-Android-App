---
id: architecture-workspace
title: Workspace overview
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [workspace]
related:
  - ../environment/build-and-test.md
  - ../environment/security-baseline.md
source-of-truth-files:
  - pnpm-workspace.yaml
  - package.json
  - tsconfig.base.json
  - tsconfig.json
  - replit.md
---

# Workspace overview

## Purpose
A pnpm-workspaces monorepo holding the Financial Clarity React app, an Express
5 API server, an OpenAPI-driven codegen pipeline, and a Drizzle/PostgreSQL data
layer. Every package manages its own dependencies and exposes a `build` and
`typecheck` script.

## Top-level layout
- [artifacts/](../../../artifacts/) — buildable end-user deliverables.
  - [financial-clarity/](../../../artifacts/financial-clarity/) — React + Vite + Capacitor money-manager app. See [financial-clarity.md](./financial-clarity.md).
  - [api-server/](../../../artifacts/api-server/) — Express 5 server. See [api-server.md](./api-server.md).
  - [mockup-sandbox/](../../../artifacts/mockup-sandbox/) — visual mockup playground. See [mockup-sandbox.md](./mockup-sandbox.md).
- [lib/](../../../lib/) — reusable libraries consumed by artifacts.
  - [api-spec/](../../../lib/api-spec/) — OpenAPI source + Orval codegen. See [api-spec.md](./api-spec.md).
  - [api-client-react/](../../../lib/api-client-react/) — generated React Query hooks. See [api-client-react.md](./api-client-react.md).
  - [api-zod/](../../../lib/api-zod/) — generated Zod schemas. See [api-zod.md](./api-zod.md).
  - [db/](../../../lib/db/) — Drizzle ORM + Postgres schema. See [db.md](./db.md).
- [scripts/](../../../scripts/) — workspace-level utility scripts (TypeScript, build via own `tsconfig`).

## Workspace declaration
`packages` glob is defined in [pnpm-workspace.yaml](../../../pnpm-workspace.yaml):
```yaml
packages:
  - artifacts/*
  - lib/*
  - lib/integrations/*
```

## Stack
- **Node.js** 24
- **Package manager** pnpm 10.x (enforced via `preinstall` script in [package.json](../../../package.json))
- **TypeScript** ~5.9.2 (root devDependency; pinned for every package)
- **Formatter** prettier ^3.8.1
- **API framework** Express 5
- **Database** PostgreSQL via Drizzle ORM
- **Validation** Zod (`zod/v4`) + `drizzle-zod`
- **API codegen** Orval (OpenAPI → React Query + Zod)
- **Build** esbuild (CJS bundle for server-side packages)

## Top-level commands
See [environment/build-and-test.md](../environment/build-and-test.md) for the
complete command reference. Quick list:
- `pnpm run typecheck` — full typecheck (libs via project references + each artifact).
- `pnpm run build` — typecheck + run every package's `build` script.

## TypeScript layout
- [tsconfig.base.json](../../../tsconfig.base.json) — shared compiler options.
- [tsconfig.json](../../../tsconfig.json) — root project-references entry used
  by `tsc --build` (`pnpm run typecheck:libs`).

## Conventions
- Every package's `name` is `@workspace/<folder-name>`.
- Filter syntax: `pnpm --filter @workspace/<name> run <script>`.
- `preinstall` rejects any non-pnpm install and deletes `package-lock.json` /
  `yarn.lock` if present.

## Known gotchas
- The supply-chain hardening in [.npmrc](../../../.npmrc) (`minimumReleaseAge: 1440`)
  blocks freshly-published packages for 24h. See
  [environment/security-baseline.md](../environment/security-baseline.md).
