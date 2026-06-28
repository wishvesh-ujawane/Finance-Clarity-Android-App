---
id: api-openapi
title: OpenAPI source + Orval codegen pipeline
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [api-spec, api-client-react, api-zod, api-server]
related:
  - ../architecture/api-spec.md
  - ../architecture/api-client-react.md
  - ../architecture/api-zod.md
  - ../architecture/api-server.md
source-of-truth-files:
  - lib/api-spec/openapi.yaml
  - lib/api-spec/orval.config.ts
---

# OpenAPI source + Orval codegen pipeline

## Contract source
[lib/api-spec/openapi.yaml](../../../lib/api-spec/openapi.yaml) is the **only**
hand-edited contract artefact. Everything client- and validation-shaped is
derived from it.

## Generated artifacts
| Output | Package | Purpose |
|--------|---------|---------|
| React Query hooks | [`@workspace/api-client-react`](../architecture/api-client-react.md) | Typed hooks consumed by React features. |
| Zod schemas | [`@workspace/api-zod`](../architecture/api-zod.md) | Runtime validation for API server and (optionally) client. |

Both land under each package's `src/generated/` directory and are overwritten
on every codegen run.

## Regeneration
```bash
pnpm --filter @workspace/api-spec run codegen
```
Run this whenever `openapi.yaml` changes. The change is not detected by
`pnpm run typecheck` alone — drift between the spec and the generated code
will eventually surface as a runtime mismatch.

## Consumers
- [api-server](../architecture/api-server.md) — uses Zod schemas for request /
  response validation.
- The Financial Clarity app **does not** consume the client today (it is
  localStorage-only).

## Versioning policy
Breaking spec changes require:
1. Edit `openapi.yaml`.
2. Re-run codegen.
3. Update consumers in the same PR.
4. File an [ADR](../decisions/) if the change establishes or alters a contract
   convention.

## Known gotchas
- Imports must use `zod/v4`, never bare `zod`, to match the pinned subpath.
  See [api-zod.md](../architecture/api-zod.md).
- Do not hand-edit `src/generated/` in either downstream package.
