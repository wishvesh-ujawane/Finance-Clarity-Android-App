---
id: feature-analysis
title: Analysis screen (Overview / Planning / Trends)
date: 2026-06-28
updated: 2026-07-05
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./dashboard.md
  - ./budgets.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Analysis.tsx
  - artifacts/financial-clarity/src/components/analysis/
  - artifacts/financial-clarity/src/lib/analysis-utils.ts
---

# Analysis screen

## User-visible behavior
Three swipeable panes — **Overview**, **Planning**, **Trends** — selectable
via tabs at the top or by horizontal drag.

- **Overview**: revenue, top categories, weekly insights, smart alerts
  (`components/analysis/OverviewPane.tsx`).
- **Planning**: forecast / planning view (`PlanningPane.tsx`).
- **Trends**: month-over-month bar chart and category breakdown
  (`TrendsPane.tsx`).

## Entry points
- Route: `/analysis`.
- File: [pages/Analysis.tsx](../../../artifacts/financial-clarity/src/pages/Analysis.tsx).

## State & data sources
Local state for `activeIndex` and `paneWidth`. Derived metrics from
[lib/analysis-utils.ts](../../../artifacts/financial-clarity/src/lib/analysis-utils.ts)
fed by [FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx).

## Interactions
- **Tab buttons** — set `activeIndex` directly.
- **Horizontal swipe** — Framer Motion `motion.div` (lines 139–160 of
  `Analysis.tsx`) with:
  - `drag="x"`, `dragDirectionLock`, `dragConstraints={{ left: 0, right: 0 }}`,
    `dragElastic={0.15}`
  - `animate={{ x: \`${-activeIndex * (100 / 3)}%\` }}`
  - `transition={{ type: 'spring', stiffness: 320, damping: 32 }}`
  - Threshold (lines 37–40): pane changes when drag exceeds **50 px** or
    **18 %** of pane width, whichever is larger.
- `paneWidth` (lines 19–21) is measured from `sliderRef` via
  `useLayoutEffect`.

## Edge cases & empty states
- Narrow viewports (< ~280 px) effectively use the 50 px floor instead of the
  18 % rule.

## Known gotchas
- Damping 32 can feel "sticky" on slow drags — change with care.
- `dragElastic: 0.15` produces minimal bounce; UI tweaks should preserve the
  feeling.

## Overview pane — Budget Health tile interactions (added 2026-07-05)
The four tiles inside the **Budget Health** card (Zone 1 of
[`OverviewPane.tsx`](../../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx))
are interactive:

| Tile | Behavior |
|------|----------|
| **Budget** | `<Link href="/budgets">` — navigates to the Budgets screen. `data-testid="tile-budget"`. |
| **Expenses this month** | Opens the **Expenses this month** bottom sheet listing day-to-day expense categories (excludes commitments and savings) for `selectedMonth`, sorted by spent DESC. Sum matches `monthlyDayToDay`. `data-testid="tile-expenses-this-month"`, list `data-testid="expense-breakdown-list"`. |
| **Commitments** | Opens the **Commitments** bottom sheet listing commitment-type categories only for `selectedMonth`, sorted by spent DESC. Sum matches `monthlyCommitments`. `data-testid="tile-commitments"`, list `data-testid="commitments-breakdown-list"`. |
| **Days Left** | Passive display. |

The **Commitments** KPI card in Zone 2 (`data-testid="kpi-commitments"`) is
also a button that opens the same commitments breakdown sheet — the two
Commitments surfaces in the Overview pane behave consistently.

Both new sheets reuse the visual shape of the existing "Category Spend
Breakdown" sheet (`allCategoriesOpen`): bottom sheet, `max-h-[82vh]`,
`CategoryIcon` + name + `pct` on the left, `formatINR(amount)` on the right.
No new tokens, no new spring constants.
