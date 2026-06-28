---
id: architecture-api-spec
title: API spec + Orval codegen (`@workspace/api-spec`)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [api-spec]
related:
  - ./api-client-react.md
  - ./api-zod.md
  - ../api/openapi.md
source-of-truth-files:
  - lib/api-spec/openapi.yaml
  - lib/api-spec/orval.config.ts
  - lib/api-spec/package.json
---

# API spec + Orval codegen (`@workspace/api-spec`)

## Purpose
Holds the canonical OpenAPI contract and the Orval codegen configuration that
emits both the React Query client (`@workspace/api-client-react`) and the Zod
schemas (`@workspace/api-zod`).

## Entry points
- [openapi.yaml](../../../lib/api-spec/openapi.yaml) — single source of truth
  for every server-client contract.
- [orval.config.ts](../../../lib/api-spec/orval.config.ts) — codegen targets
  and per-target options.

## Codegen command
```bash
pnpm --filter @workspace/api-spec run codegen
```
Regenerates both downstream packages. Run after any change to `openapi.yaml`.

## Dependencies
- Upstream: none.
- Downstream: [api-client-react](./api-client-react.md), [api-zod](./api-zod.md),
  and (transitively) any consumer of those.

## Versioning
Breaking changes to `openapi.yaml` require:
1. Updating the spec.
2. Re-running codegen.
3. A coordinated PR that updates all consumers in the same commit.
4. An ADR if the change alters established contract conventions.

## Known gotchas
- Forgetting to run codegen after editing `openapi.yaml` leaves
  `api-client-react` and `api-zod` out of date. `pnpm run typecheck` will not
  detect spec drift on its own.
