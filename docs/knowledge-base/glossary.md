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

## Commitment
A category whose `type === 'commitment'` (see `Category.type` in
[types.ts](../../artifacts/financial-clarity/src/lib/types.ts)). Conceptually
a fixed-obligation expense such as rent or a loan EMI. A commitment-typed
category can still have a budget — when it does, transactions in that
category count as **budgeted spending** and are included in the
`spentOnBudgeted` numerator on both Budgets and Analysis (see
[ADR-0002](./decisions/0002-canonical-budget-summary.md)). Commitments are
surfaced separately on the Analysis Overview pane as informational figures;
they are **never** subtracted from the numerator.

## Day-to-day spend
Informal label for the residual `monthlyExpenses - monthlyCommitments`
([useAnalysisShared.ts](../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts)).
Used in some Overview/Planning copy ("day-to-day budget") but **not** the
headline math: the canonical numerator (`spentOnBudgeted`) **includes**
commitments-with-budgets. Do not introduce a "day-to-day" denominator
without an ADR; see [ADR-0002](./decisions/0002-canonical-budget-summary.md).

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

## Monthly budget total
The legacy `monthlyBudgetTotal` value on
[useAnalysisShared](../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts):
the **combined** sum of all budget limits for the selected month (spending +
savings). Still consumed by `PlanningPane.tsx` for its allocation-vs-income
view, but **not** used for any headline budget-performance figure. For
headline math use `BudgetSummary.spendingBudget` instead; see
[ADR-0002](./decisions/0002-canonical-budget-summary.md).

## Orval
The avings budget
The sum of all budget limits whose category has `type === 'savings'` for a
given month — exposed as `BudgetSummary.savingsBudget` on
[FinanceContext](../../artifacts/financial-clarity/src/context/FinanceContext.tsx).
Conceptually an **allocation** of income toward savings goals, not
"spending against budget". Shown on the Budgets screen as a `"+ ₹X savings"`
sublabel beside the main spending-budget figure and **never** folded into
over/under math. Pinned by
[ADR-0002 decision point Q1](./decisions/0002-canonical-budget-summary.md#context).

## Spent on budgeted
`BudgetSummary.spentOnBudgeted` on
[FinanceContext](../../artifacts/financial-clarity/src/context/FinanceContext.tsx).
The **full-month** sum of expense transactions in non-savings **budgeted**
categories for a given month, **including** commitments-with-budgets.
Canonical numerator for both the Budgets screen over/under banner and the
Analysis Overview "Budget Health" percentage. Pinned by
[ADR-0002](./decisions/0002-canonical-budget-summary.md).

## Surplus
On the Budgets screen, the difference between total income (minus carry-forward
adjustments) and the sum of allocated budgets for the selected month. Shown in
the dark-blue Surplus bar. Distinct from `BudgetSummary.overUnder`, which
compares **spending** to budgets; surplus compares **allocation** to incomeapi-spec/openapi.yaml).

## pnpm workspace
The monorepo layout declared in [pnpm-workspace.yaml](../../pnpm-workspace.yaml).
Packages live under `artifacts/*`, `lib/*`, and `lib/integrations/*`.

## Surplus
On the Budgets screen, the difference between total income (minus carry-forward
adjustments) and the sum of allocated budgets for the selected month. Shown in
the dark-blue Surplus bar.
