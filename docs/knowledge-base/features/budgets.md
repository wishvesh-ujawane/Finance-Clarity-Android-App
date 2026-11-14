---
id: feature-budgets
title: Budgets screen
date: 2026-06-28
updated: 2026-11-14
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
Monthly budgets and savings targets. Header shows "Monthly · Budgets" and a
"Copy to {next month}" button.

**Budget summary** (since 2026-11-14, ADR-0009): `BudgetSummaryCard` shows
"Budgets for {Month}" with one row each for Day-to-day, Commitments, and
Savings ("₹X spent/paid/saved of ₹Y" with a status line), a "+ ₹N … in
categories without a budget" line where it applies, and "All spending this
month" (equals Dashboard Expenses). It reads `getBudgetBreakdown(month)`
(`budgetSummary` in `lib/domain/budgets.ts`), the same data Analysis
Overview shows. It replaced the "{Month} Month Budget" and "Spent on
budgeted" tiles.

The **allocation strip** (dark blue `bg-[hsl(222,65%,13%)]`) shows
`Not yet budgeted · ₹X of ₹Y` (or "Budgeted ₹X more than you have"), "N%
budgeted", and a caption: available = carry-forward + the month's income;
limits include savings.

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
- **Copy to {next month}** (renamed from "Transfer" on 2026-11-12) —
  disabled when the month has no budgets. Copies **limits only** (PRD FR-05):
  no money moves and spending is unchanged. The confirmation, built from
  `planBudgetCopy` in `lib/domain/budgets.ts`, lists each new budget, each
  replaced limit (old → new), how many other next-month budgets stay as they
  are, and inactive categories that are not copied.
- **Allocation strip** — purely informational.
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
- Over-allocated month: the allocation strip turns red and reads "Budgeted
  ₹X more than you have (₹Y)".

## Cross-feature dependencies
- [categories.md](./categories.md) — budgets are keyed by `categoryId`.
- [savings-goals.md](./savings-goals.md) — rendered in the same screen but
  managed via its own context entries.

## Known gotchas
- Allocation strip uses a **hardcoded** dark blue `hsl(222,65%,13%)` instead of a
  Tailwind theme token; any palette change must touch this directly.
