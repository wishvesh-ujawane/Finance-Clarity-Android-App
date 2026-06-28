---
id: feature-savings-goals
title: Savings Goals
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./budgets.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/SavingsGoals.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
---

# Savings Goals

## User-visible behavior
Track named savings targets with a current amount and a goal amount. Rendered
as a dedicated screen and **also** reflected inside the savings section of the
[Budgets screen](./budgets.md). Progress bar is green when on-target, amber
between 70–100 %.

## Entry points
- Route: `/savings` (linked from Settings).
- File: [pages/SavingsGoals.tsx](../../../artifacts/financial-clarity/src/pages/SavingsGoals.tsx).

## State & data sources
`savingsGoal` (or savings goals collection) on
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx).

## Interactions
- Create / edit / delete a savings goal.
- Adjust the current saved amount.

## Cross-feature dependencies
- [budgets.md](./budgets.md) — the Budgets screen renders a parallel
  savings-targets section using the same data.
