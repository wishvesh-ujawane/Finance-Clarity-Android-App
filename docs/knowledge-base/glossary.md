---
id: glossary
title: Glossary
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [workspace]
related: []
source-of-truth-files: []
---

# Glossary

Domain and project-specific terms used across this workspace. Keep entries
alphabetical, one short paragraph per term, and link to the canonical
architecture or feature entry when one exists.

To add a term, copy [`_templates/glossary-entry.md`](./_templates/glossary-entry.md)
into this file in alphabetical order.

---

## ADR — Architecture Decision Record
A numbered, immutable note explaining *why* a particular technical choice was
made. Stored under [decisions/](./decisions/). New ADRs are added; existing ADRs
are superseded but never edited in place.

## App Oracle
The custom subagent ([.github/agents/app-oracle.agent.md](../../.github/agents/app-oracle.agent.md))
that owns this knowledge base. Sole writer for files in `docs/knowledge-base/`.

## Artifact
A buildable end-user-facing deliverable inside `artifacts/*` (for example the
Financial Clarity React app or the API server). Distinct from `lib/*`, which
holds reusable libraries.

## Carry-forward
The unspent portion of a previous month's budget that rolls into the next
month's available balance. Computed by `getCarryForward()` in
[finance-utils.ts](../../artifacts/financial-clarity/src/lib/finance-utils.ts).

## FAB — Floating Action Button
The fixed circular `+` button rendered by
[FAB.tsx](../../artifacts/financial-clarity/src/components/FAB.tsx). Its
per-screen action is registered via the `useFabAction` hook from
[FabContext.tsx](../../artifacts/financial-clarity/src/context/FabContext.tsx).

## Financial Clarity
The React + Vite + Capacitor personal-finance mobile/web app under
[artifacts/financial-clarity/](../../artifacts/financial-clarity/). Local-only
persistence (localStorage); no backend dependency.

## INR formatting
Indian-rupee currency formatting (e.g. `₹1,23,456`) implemented by
`formatINR()` and the compact `formatAmount()` in
[finance-utils.ts](../../artifacts/financial-clarity/src/lib/finance-utils.ts).

## Orval
The OpenAPI-driven codegen tool ([lib/api-spec/orval.config.ts](../../lib/api-spec/orval.config.ts))
that produces both the React-Query client (`@workspace/api-client-react`) and
the Zod schemas (`@workspace/api-zod`) from
[openapi.yaml](../../lib/api-spec/openapi.yaml).

## pnpm workspace
The monorepo layout declared in [pnpm-workspace.yaml](../../pnpm-workspace.yaml).
Packages live under `artifacts/*`, `lib/*`, and `lib/integrations/*`.

## Surplus
On the Budgets screen, the difference between total income (minus carry-forward
adjustments) and the sum of allocated budgets for the selected month. Shown in
the dark-blue Surplus bar.
