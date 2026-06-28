---
id: bug-20260628-budgets-analysis-divergence
title: Budgets and Analysis showed different headline budget figures for the same month
date: 2026-06-28
updated: 2026-06-28
status: fixed
scope: [financial-clarity]
related:
  - ../features/budgets.md
  - ../features/analysis.md
  - ../decisions/0002-canonical-budget-summary.md
  - ../glossary.md
source-of-truth-files:
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/pages/Budgets.tsx
  - artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx
  - artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts
---

# Budgets and Analysis showed different headline budget figures for the same month

## Symptom
For the user's June data the Budgets screen rendered:

- Total budget: **₹1,85,500**
- Spent on budgeted: **₹1,55,369**
- **₹4,869 over** (red banner)

For the **same month and same data**, the Analysis screen Budget Health
card rendered:

- **54.7 % spent**, status pill: **"On track"**

54.7 % and "₹4,869 over budget" describe the same input but disagree by
roughly **45 percentage points** and flip the user-facing status from green
to red. The bug was visible on any month where savings budgets were
configured alongside spending budgets and where commitments-with-budgets had
non-trivial spend.

## Root cause
Four divergent definitions of "budget math" were scattered across the
codebase, each computed via screen-local reductions:

| Surface | Denominator | Numerator |
|---|---|---|
| Budgets headline tile (before) | `sum(all budget limits)` — included savings limits | `sum(expenses in any budgeted category)` — full month |
| Budgets over/under banner (before) | combined budget total | full-month expense reduction (subtly different filter) |
| Analysis Budget Health % (before) | spending-budget total (excl. savings) | expenses-to-date minus commitments-to-date |
| Analysis Budget Health "Expenses this month" tile (before) | n/a | monthly expense total filtered differently again |

The Budgets figures used combined (spending + savings) totals while the
Analysis percentage used a smaller denominator and subtracted commitments
from the numerator, producing a much smaller ratio. There was no central
selector; every screen wrote its own reduction over `transactions` and
`budgets`.

No invariant linked the two screens, so drift was inevitable as either side
was tweaked.

## Fix
Commit [`bb1afa7`](https://github.com/wishvesh-ujawane/Finance-Clarity-Android-App/commit/bb1afa7) on branch
`fix/budgets-analysis-reconciliation` (`fix(financial-clarity): reconcile
Budgets and Analysis budget math`, 4 files, +94 / −43):

1. Added a canonical `BudgetSummary` interface and `getBudgetSummary(month)`
   selector to the Finance context
   ([FinanceContext.tsx L29-L37](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L29-L37),
   [L691-L728](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L691-L728)).
2. Rewrote the Budgets headline
   ([Budgets.tsx](../../../artifacts/financial-clarity/src/pages/Budgets.tsx))
   to consume the selector. The big number is now `spendingBudget`; savings is
   shown as a `+ ₹X savings` sublabel; the over/under banner uses
   `overUnder`. Dead local reductions deleted.
3. Rewrote the Analysis Overview Budget Health card
   ([OverviewPane.tsx](../../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx))
   to consume the selector. Tile label `"Expenses this month"` →
   **`"Spent on budgeted"`**. Key Numbers `"Commitments"` →
   **`"Commitments (paid so far)"`** to disambiguate full-month vs to-date.
4. Exposed `budgetSummary` on the shared Analysis hook
   ([useAnalysisShared.ts](../../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts));
   removed orphaned `monthlyDayToDayToDate`; kept `monthlyBudgetTotal`
   (still consumed by `PlanningPane.tsx`).

Canonical post-fix definitions are pinned in
[ADR-0002](../decisions/0002-canonical-budget-summary.md) and surfaced on the
feature entries
([budgets.md "Math" section](../features/budgets.md#math), and
[analysis.md "Budget Health card" section](../features/analysis.md#budget-health-card-overview)).

## Tests
None added in `bb1afa7` — the fix relied on `pnpm run typecheck` plus manual
verification by the user on the June fixture. Follow-up filed in
[ADR-0002 follow-ups](../decisions/0002-canonical-budget-summary.md#consequences):
add an integration test mounting both screens with a shared fixture and
asserting identical headline figures.

## Lessons
- "Same number on two screens" must be enforced by a shared selector, not by
  copy-pasting reductions. Two screens that each `transactions.reduce(...)`
  will drift the first time either side is touched.
- Headline figures should be **full-month** by default. Mixing to-date and
  full-month numerators across surfaces produces invisible divergence that
  only shows up for users mid-month.
- "Savings" is a category type with its own semantics (allocated income, not
  budgeted spending). Folding it into "spend vs budget" math is wrong by
  default. See [glossary "Savings budget"](../glossary.md#savings-budget).
- Commitment categories that also have a budget are still **budgeted
  spending** — they belong in the numerator, not subtracted from it. See
  [glossary "Commitment"](../glossary.md#commitment).
