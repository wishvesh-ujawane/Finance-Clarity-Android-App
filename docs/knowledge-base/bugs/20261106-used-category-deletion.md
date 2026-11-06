---
id: bug-20261106-used-category-deletion
title: Categories with transactions, budgets, or recurring rules could be deleted
date: 2026-11-06
updated: 2026-11-06
status: fixed
scope: [financial-clarity, categories]
related:
  - ../features/categories.md
  - ../../audits/2026-11-06-e2e-browser-audit.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/category-rules.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/pages/Categories.tsx
---

# Categories with transactions, budgets, or recurring rules could be deleted

## Symptom
Found in the [2026-11-06 browser audit](../../audits/2026-11-06-e2e-browser-audit.md) (F-07):
opening "Groceries" while it had transactions still offered **Delete
Category**. Confirming removed the category and its budgets, and the
transactions then showed as "Unknown". The built-in month-end adjustment
categories also offered Delete.

## Root cause
`deleteCategory` only refused the two savings ids. It had no usage check, and
it removed the category's budgets as a side effect. The page always rendered
the Delete button.

## Fix
- New pure module `lib/category-rules.ts`: `isReservedCategory`,
  `getCategoryUsage`, `canDeleteCategory`, `describeCategoryDeleteBlock`.
  Reserved = savings and month-end adjustment categories. Usage =
  transactions, budgets, and recurring expenses.
- `FinanceContext.deleteCategory` enforces the rule and returns
  `{ ok: true }` or `{ ok: false, reason }`; it no longer deletes budgets.
- `Categories.tsx` shows Delete only for unused, non-reserved categories and
  otherwise explains why it can't be deleted.

## Tests
- [category-rules.test.ts](../../../artifacts/financial-clarity/src/lib/__tests__/category-rules.test.ts).
- [FinanceContext.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx) — refused
  deletes leave categories, transactions, and budgets intact.
- [audit-2026-11-06.pw.ts](../../../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) — CAT-002 now passes.

## Lessons
Business rules must live in the mutation, not only in which buttons are
shown (AGENTS.md §10.1).
