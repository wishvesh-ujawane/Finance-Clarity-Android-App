---
id: architecture-api-zod
title: Generated Zod schemas (`@workspace/api-zod`)
date: 2026-06-28
updated: 2026-11-06
status: deprecated
scope: [api-zod]
related:
  - ./api-spec.md
  - ./api-client-react.md
source-of-truth-files:
  - lib/api-zod/package.json
  - lib/api-zod/tsconfig.json
  - lib/api-zod/src/index.ts
---

# Generated Zod schemas (`@workspace/api-zod`)

> **Deprecated 2026-11-06.** This package was deleted from the workspace because the app is local-only (on-device storage, Google Drive backup, CSV import/export) and never used it. Links to its source files below no longer resolve. This entry is kept as a historical record only. See [workspace.md](./workspace.md).

## Purpose
Zod (`zod/v4`) schemas mirroring every OpenAPI component and request/response
shape. Used by the API server for runtime validation and (when wired in) by the
React client for parse-on-receive safety.

## Entry points
- [src/index.ts](../../../lib/api-zod/src/index.ts) — public re-exports.
- [src/generated/](../../../lib/api-zod/src/generated/) — Orval output; **do
  not edit by hand**.

## Regeneration
See [api-spec.md](./api-spec.md):
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Consumers
- [api-server](./api-server.md) for request/response validation.
- Future React features that need runtime type guards.

## Known gotchas
- `zod/v4` subpath — imports must be from `zod/v4`, not bare `zod`, to match
  the pinned version path. Mixing both can produce duplicate Zod instances and
  failed `instanceof ZodError` checks.
