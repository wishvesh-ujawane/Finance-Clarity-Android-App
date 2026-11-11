---
id: feature-categories
title: Categories screen
date: 2026-06-28
updated: 2026-11-12
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
- Mark a category inactive or active (`FinanceContext.setCategoryActive`).
  Inactive categories stay on existing records, show an "Inactive" badge,
  and are listed after active ones. They are hidden from the transaction,
  budget, recurring-rule, and month-end budget pickers.
- Inline creation also happens from inside
  [TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx).

## Edge cases
- Usage means any transaction, budget, or recurring expense referring to the
  category. Dependent records are never deleted with a category.
- Built-in categories (Goal Savings, Emergency Fund, Missed Spend,
  Over-logged Reversal) can never be deleted. Those plus Other and Other
  Income can never be made inactive; a stored inactive value is corrected at
  load.
- New transactions, new budgets, and new or edited recurring rules are
  refused in an inactive category. Editing a transaction may keep its current
  inactive category (PRD FR-03 assumption, pending owner confirmation).
- An active recurring rule whose category becomes inactive keeps generating;
  it is not paused or deleted (PRD FR-03 pending detail).
- CSV import may still match an existing inactive category by name, because
  it restores history.
- Data saved before 2026-11-12 has no `active` value; local migration 1 and
  backup v5 store `true`.

## Cross-feature dependencies
- [transactions.md](./transactions.md), [budgets.md](./budgets.md),
  [dashboard.md](./dashboard.md), [analysis.md](./analysis.md) — every screen
  that shows category icon/colour reads from here.
