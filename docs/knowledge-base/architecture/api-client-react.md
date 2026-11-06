---
id: architecture-api-client-react
title: Generated React Query client (`@workspace/api-client-react`)
date: 2026-06-28
updated: 2026-11-06
status: deprecated
scope: [api-client-react]
related:
  - ./api-spec.md
  - ./api-zod.md
source-of-truth-files:
  - lib/api-client-react/package.json
  - lib/api-client-react/tsconfig.json
  - lib/api-client-react/src/index.ts
  - lib/api-client-react/src/custom-fetch.ts
---

# Generated React Query client (`@workspace/api-client-react`)

> **Deprecated 2026-11-06.** This package was deleted from the workspace because the app is local-only (on-device storage, Google Drive backup, CSV import/export) and never used it. Links to its source files below no longer resolve. This entry is kept as a historical record only. See [workspace.md](./workspace.md).

## Purpose
Provides typed React Query hooks for every endpoint declared in
[openapi.yaml](../../../lib/api-spec/openapi.yaml). Output of the Orval pipeline
in [api-spec](./api-spec.md).

## Entry points
- [src/index.ts](../../../lib/api-client-react/src/index.ts) — public surface
  (hand-written re-exports of the generated hooks).
- [src/custom-fetch.ts](../../../lib/api-client-react/src/custom-fetch.ts) —
  hand-written fetch wrapper used by the generated client (auth, base URL,
  error normalization).
- [src/generated/](../../../lib/api-client-react/src/generated/) — Orval
  output; **do not edit by hand**.

## Regeneration
See [api-spec.md](./api-spec.md). After any spec change, run:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Consumers
Reserved for future use. The Financial Clarity app is currently
localStorage-only and does not import this package.

## Known gotchas
- The `src/generated/` tree is overwritten on every codegen run — any local
  edits there will be lost. Customise via `custom-fetch.ts` or Orval config
  instead.
