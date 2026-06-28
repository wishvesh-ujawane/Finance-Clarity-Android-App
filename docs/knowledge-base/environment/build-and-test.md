---
id: environment-build-and-test
title: Build, test, and tooling commands
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [workspace]
related:
  - ../architecture/workspace.md
  - ./security-baseline.md
  - ../api/openapi.md
source-of-truth-files:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.json
  - replit.md
---

# Build, test, and tooling commands

## Summary
The workspace uses pnpm 10 + Node 24 + TypeScript ~5.9. Every package exposes a
`build` and `typecheck` script (where applicable) that the root scripts fan out
to.

## Install
```bash
pnpm install
```
The `preinstall` hook in [package.json](../../../package.json) rejects any
non-pnpm install and removes `package-lock.json` / `yarn.lock` if present.

## Top-level commands
```bash
# full typecheck (lib project references + each artifact + scripts)
pnpm run typecheck

# typecheck + build every package
pnpm run build

# library project references only
pnpm run typecheck:libs
```

## Per-package commands
```bash
# regenerate API client + Zod from openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# push DB schema to dev Postgres (dev only)
pnpm --filter @workspace/db run push

# run API server locally
pnpm --filter @workspace/api-server run dev
```

## Files involved
- [package.json](../../../package.json) — root scripts.
- [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) — `packages` globs.
- [tsconfig.base.json](../../../tsconfig.base.json), [tsconfig.json](../../../tsconfig.json)
  — TS compiler config + project references.

## Gotchas
- The codegen step is not part of `pnpm run build`. After editing
  [openapi.yaml](../../../lib/api-spec/openapi.yaml), run the
  `api-spec codegen` filter command before `build`. See
  [api/openapi.md](../api/openapi.md).
- `db push` rewrites the dev database in place; never run against production
  or a shared environment.
- See [security-baseline.md](./security-baseline.md) for the
  `minimumReleaseAge` install delay.
