---
id: feature-dashboard
title: Dashboard screen
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./fab.md
  - ./transactions.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Dashboard.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
---

# Dashboard screen

## User-visible behavior
Top-level landing screen. Shows the balance card for the selected month, a
month selector, a Recharts donut chart of spend per category, and the most
recent transactions.

## Entry points
- Route: `/` (default).
- File: [pages/Dashboard.tsx](../../../artifacts/financial-clarity/src/pages/Dashboard.tsx).

## State & data sources
Reads `transactions`, `categories`, `selectedMonth`, `getTotalIncome`,
`getSpentForCategory`, `getCarryForward` from
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx).

## Interactions
- **Month selector** — changes `selectedMonth` on the context; the rest of the
  app re-reads from it.
- **Donut chart** — Recharts PieChart per-category spend.
- **Recent transactions list** — taps open the [Transactions](./transactions.md)
  screen or the per-transaction edit sheet.
- **FAB** — registered via `useFabAction` to open the
  [TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx).
  See [fab.md](./fab.md).

## Edge cases & empty states
- Empty month: balance card shows zero state, donut hides, recent list shows
  empty placeholder.

## Cross-feature dependencies
- [budgets.md](./budgets.md) — surplus / carry-forward logic shared via
  `finance-utils.ts`.
- [categories.md](./categories.md) — donut and recent list rely on category
  colors and icons.
- [month-end-review.md](./month-end-review.md) — Dashboard hosts the
  `MonthEndReviewBanner` above `ConnectDriveBanner`. Banner is visible
  whenever a review is pending and hidden once the user completes it.

## Related changes
_None yet._
