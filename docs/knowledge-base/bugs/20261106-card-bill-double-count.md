---
id: bug-20261106-card-bill-double-count
title: Card bill payments counted as spending on some screens
date: 2026-11-06
updated: 2026-11-12
status: fixed
scope: [financial-clarity, dashboard, budgets, analysis]
related:
  - ../../audits/2026-11-06-cleanup-phases-3-4-review.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts
  - artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx
  - artifacts/financial-clarity/src/pages/Dashboard.tsx
---

# Card bill payments counted as spending on some screens

## Symptom

PRD §6 says consumption spending excludes credit-card bill payments, because
the card purchases were already counted. Some screens counted the payment
again, so the same month showed different spending on different screens:

- Analysis month totals, monthly net, and the savings-rate trend
  (`getMonthSummary`).
- Budget "spent" on Budgets, the Dashboard budget alerts, and the Analysis
  budget rows (`getSpentForCategory` and a local sum in `OverviewPane`).
- Dashboard "Spent ₹X today".
- Analysis commitments, to-date totals, the spend-by-category donut, and the
  day-to-day and commitment drill-down lists.

Smallest case: record a ₹1,000 card purchase and a ₹1,000 bill payment in the
same category and month. The Dashboard month expenses show ₹1,000; Analysis
showed ₹2,000.

## Root cause

Each screen or selector filtered transactions itself. Only some of them used
the shared `isConsumptionExpense` rule; the others filtered on
`type === 'expense'` minus savings categories, which keeps bill payments.

## Fix

Phase 3 (2026-11-12): every PRD §6 metric now has one implementation in
`lib/domain/finance-metrics.ts`. `FinanceContext` selectors, `analysis-utils`,
`useAnalysisShared`, `OverviewPane`, and the Dashboard call those functions.
Budget spent is consumption for a spending category and savings contributions
for a savings category.

Not changed: the month-end review snapshot (`lib/month-end-review.ts`) still
counts bill payments, because month-end behavior is pending owner review
(PRD D8). Analysis-only figures (safe-to-spend balance, weekday heatmap, daily
spend, budget burndown, known future expenses) are left for Phase 7.

## Tests

- [finance-metrics.test.ts](../../../artifacts/financial-clarity/src/lib/domain/__tests__/finance-metrics.test.ts): each metric on one synthetic dataset.
- [cross-screen-consistency.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/cross-screen-consistency.test.tsx): Dashboard selectors, the month summary, Analysis, and budget breakdowns agree. Three of its five tests fail on the pre-fix code.

## Lessons

Never filter transactions for a total inside a screen. Add or reuse a
function in `lib/domain/finance-metrics.ts` (AGENTS §5).
