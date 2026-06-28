---
id: feature-categories
title: Categories screen
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./transactions.md
  - ./budgets.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Categories.tsx
  - artifacts/financial-clarity/src/components/CategoryIcon.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
---

# Categories screen

## User-visible behavior
Manage the list of transaction categories. Each category has an icon (mapped
in [CategoryIcon.tsx](../../../artifacts/financial-clarity/src/components/CategoryIcon.tsx))
and a colour used by donut and progress bars across the app.

## Entry points
- Route: `/categories` (reached from Settings).
- File: [pages/Categories.tsx](../../../artifacts/financial-clarity/src/pages/Categories.tsx).

## State & data sources
Reads / writes `categories` on
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx).

## Interactions
- Create new category.
- Edit name / icon / colour of an existing category.
- Delete a category (with confirmation when transactions still reference it).
- Inline creation also happens from inside
  [TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx).

## Edge cases
- Deleting a category that has transactions: confirmation dialog; deletion
  reassigns affected transactions per the implementation in `FinanceContext`.

## Cross-feature dependencies
- [transactions.md](./transactions.md), [budgets.md](./budgets.md),
  [dashboard.md](./dashboard.md), [analysis.md](./analysis.md) — every screen
  that shows category icon/colour reads from here.
