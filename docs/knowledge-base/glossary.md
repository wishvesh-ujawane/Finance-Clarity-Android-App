---
id: glossary
title: Glossary
date: 2026-06-28
updated: 2026-11-14
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
*Retired.* A former custom subagent that was the only writer of
`docs/knowledge-base/`. The coding agent now updates the knowledge base
directly under [AGENTS.md](../../AGENTS.md) §12.

## Artifact
A buildable end-user-facing deliverable inside `artifacts/*`. The only artifact
is the Fiscal Focus app (`artifacts/financial-clarity`).

## Card bill payment
An expense entry that pays the credit card bill. It lowers the outstanding
card amount and is not consumption spending, so the card purchases it pays for
are not counted twice (PRD §6). Recorded from the card sheet or the month-end
Card bill step and listed as "Card payment". Detected by `isCardBillPayment()`
in [finance-metrics.ts](../../artifacts/financial-clarity/src/lib/domain/finance-metrics.ts).

## Card purchase
An expense saved with "Paid with credit card" ticked. It counts as consumption
when made and adds to the outstanding card amount. Shows a "Card" badge.

## Carry-forward
Cumulative income minus consumption, plus confirmed savings increases and
minus confirmed savings spent or lost, before the selected month (PRD §6).
Computed by `carryForward()` in
[finance-metrics.ts](../../artifacts/financial-clarity/src/lib/domain/finance-metrics.ts).

## Consumption spending
Expense entries excluding reserved savings categories and card bill payments
(PRD §6). Computed by `isConsumptionExpense()` and `totalConsumption()` in
[finance-metrics.ts](../../artifacts/financial-clarity/src/lib/domain/finance-metrics.ts).

## FAB — Floating Action Button
The fixed circular `+` button rendered by
[FAB.tsx](../../artifacts/financial-clarity/src/components/FAB.tsx). Its
per-screen action is registered via the `useFabAction` hook from
[FabContext.tsx](../../artifacts/financial-clarity/src/context/FabContext.tsx).

## Financial Clarity
The internal package name of the React + Vite + Capacitor personal-finance app
under [artifacts/financial-clarity/](../../artifacts/financial-clarity/). Users
see it as "Fiscal Focus" (PRD FR-01); the package name, `appId`, and the
`financial-clarity:` storage prefix are not renamed. Local-only persistence
(localStorage); no backend dependency.

## INR formatting
Indian-rupee currency formatting (e.g. `₹1,23,456`) implemented in
[format.ts](../../artifacts/financial-clarity/src/lib/format.ts):
`formatAmount()` for display (compact from 1 lakh), `formatAmountFull()` for
inputs and confirmations, and `formatAmountShort()` for charts. `formatINR()`
is a deprecated alias.

## Orval
*Removed 2026-11-06.* An OpenAPI-driven codegen tool that the former `lib/api-spec`
scaffold used to generate a React Query client and Zod schemas. It is no longer
part of the workspace.

## Outstanding card amount
All recorded card purchases minus card bill payments, floored at zero
(PRD §6). Shown on the Dashboard "On your card" chip and in the card sheet.
Computed by `outstandingCardAmount()` in
[finance-metrics.ts](../../artifacts/financial-clarity/src/lib/domain/finance-metrics.ts).

## pnpm workspace
The monorepo layout declared in [pnpm-workspace.yaml](../../pnpm-workspace.yaml).
Packages live under `artifacts/*`; today that is only the app.

## Surplus
On the Budgets screen, carry-forward plus the selected month's income, minus
the sum of that month's budget limits. Shown in the allocation strip as "Not
yet budgeted", or "Budgeted ₹X more than you have" when negative.
