---
id: feature-budgets
title: Budgets screen
date: 2026-06-28
updated: 2026-07-05
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./fab.md
  - ./savings-goals.md
  - ./categories.md
  - ./transactions.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Budgets.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/finance-utils.ts
---

# Budgets screen

## User-visible behavior
Monthly budgets and savings targets. Header shows "Monthly · Budgets". A
full-width "Transfer Budget to Next Month" button sits above the content. The
**Surplus bar** (dark blue `bg-[hsl(222,65%,13%)]`) summarises remaining
allocation as `Surplus · ₹X of ₹Y` plus a percentage and an animated progress
bar coloured red / amber / emerald by threshold. Two summary cards
(total budget / spent on budgeted) sit in a grid below.

The **budget list** renders one card per budget with category icon, name,
progress bar (red if over, amber 75–100%, category colour otherwise), edit
button (pencil), and in-edit-mode inline ₹ input plus checkmark / cancel /
delete buttons.

A separate **savings targets** section uses a PiggyBank icon and the same
layout, with green progress when on target and amber 70–100 %. See
[savings-goals.md](./savings-goals.md).

## Entry points
- Route: `/budgets`.
- File: [pages/Budgets.tsx](../../../artifacts/financial-clarity/src/pages/Budgets.tsx).

## State & data sources
Reads / writes via [FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx):
`budgets`, `addBudget`, `updateBudget`, `deleteBudget`,
`transferBudgetsToMonth`, `getSpentForCategory`, `getCarryForward`,
`getTotalIncome`, `selectedMonth`.

## Interactions
- **Transfer Budget to Next Month** (lines 52–67 of `Budgets.tsx`) — disabled
  when `currentMonthBudgets.length === 0`; opens an `AlertDialog` confirming
  the bulk copy.
- **Surplus bar** (lines 104–113) — purely informational.
- **Add Budget sheet** — opened by FAB. Registered via
  `useFabAction(openAddBudget, 'Add budget', 'fab-add-budget')`. Contains
  category select + limit input + Cancel/Save.
- **Edit-in-place** — pencil → inline `₹` input → checkmark/X/delete.
- **Category transactions sheet** — `openCategoryTransactions(categoryId)`
  opens a bottom sheet listing the transactions that count toward that budget
  for `selectedMonth`. **Since 2026-07-05:** each transaction row is a
  `<button>` (`data-testid="budget-category-txn-{id}"`) that closes the
  category sheet and calls `openEditSheet(t)` on `FinanceContext`, opening
  the standard Edit Transaction sheet pre-filled with the tapped row.

## Edge cases & empty states
- Empty state: plus-icon tile + "No budgets set".
- Over-allocated month: surplus bar flips to red and shows "over-allocated"
  status instead of "Surplus".

## Cross-feature dependencies
- [categories.md](./categories.md) — budgets are keyed by `categoryId`.
- [savings-goals.md](./savings-goals.md) — rendered in the same screen but
  managed via its own context entries.

## Known gotchas
- Surplus bar uses a **hardcoded** dark blue `hsl(222,65%,13%)` instead of a
  Tailwind theme token; any palette change must touch this directly.
