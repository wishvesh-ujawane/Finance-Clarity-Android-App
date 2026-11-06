---
id: feature-categories
title: Categories screen
date: 2026-06-28
updated: 2026-11-06
status: current
scope: [financial-clarity]
related:
  - ./transactions.md
  - ./budgets.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Categories.tsx
  - artifacts/financial-clarity/src/components/CategoryIcon.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/category-rules.ts
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
- Delete a category — only when it is unused and not built in (PRD FR-03,
  D6). `FinanceContext.deleteCategory` checks
  [lib/category-rules.ts](../../../artifacts/financial-clarity/src/lib/category-rules.ts)
  and returns `{ ok: false, reason }` instead of deleting. The edit panel
  shows Delete only when allowed; otherwise it says why ("Used by 3
  transactions and 1 budget…" or "built-in category").
- Inline creation also happens from inside
  [TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx).

## Edge cases
- Usage means any transaction, budget, or recurring expense referring to the
  category. Dependent records are never deleted with a category.
- Built-in categories (Goal Savings, Emergency Fund, Missed Spend,
  Over-logged Reversal) can never be deleted.
- Active/inactive status is not implemented yet (ARCHITECTURE §19 A3).

## Cross-feature dependencies
- [transactions.md](./transactions.md), [budgets.md](./budgets.md),
  [dashboard.md](./dashboard.md), [analysis.md](./analysis.md) — every screen
  that shows category icon/colour reads from here.
