# Architecture

Technical design — one entry per package or major module. The "how it is built".

Use [`../_templates/architecture.md`](../_templates/architecture.md) for new entries.

## Index

- [workspace.md](./workspace.md) — pnpm monorepo overview, packages, top-level commands.
- [financial-clarity.md](./financial-clarity.md) — React + Vite + Capacitor consumer app under `artifacts/financial-clarity`.
- [api-server.md](./api-server.md) — Express 5 API server under `artifacts/api-server`.
- [api-spec.md](./api-spec.md) — OpenAPI spec + Orval codegen under `lib/api-spec`.
- [api-client-react.md](./api-client-react.md) — Generated React Query client under `lib/api-client-react`.
- [api-zod.md](./api-zod.md) — Generated Zod schemas under `lib/api-zod`.
- [db.md](./db.md) — Drizzle ORM + PostgreSQL schema under `lib/db`.
- [mockup-sandbox.md](./mockup-sandbox.md) — Visual mockup sandbox under `artifacts/mockup-sandbox`.
