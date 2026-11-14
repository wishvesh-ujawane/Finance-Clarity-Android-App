---
id: feature-analysis
title: Analysis screen (Overview / Planning / Trends)
date: 2026-06-28
updated: 2026-11-14
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

## Financial rules (Phase 7, 2026-11-12)
All Analysis totals use the PRD §6 classification from
`lib/domain/finance-metrics.ts` and `lib/domain/analysis.ts`:
- **Daily Safe to Spend** divides the spendable balance (income minus
  consumption minus savings contributions through today) by the days left.
  Card bill payments are not subtracted again.
- **Projected month-end balance** needs at least one earlier month of
  entries; otherwise the Planning tab shows "Insufficient history". Known
  future spending counts later consumption and savings in the month, not card
  bill payments.
- **Budget suggestions** skip inactive categories (unless next month already
  has that budget), ask before replacing an existing limit, and report a save
  failure with how many suggestions were saved.
- **Trends** (since 2026-11-14, ADR-0009): daily spend calendar and Income vs
  Spend show consumption. "What changed vs last month"
  (`categorySpendChanges`) compares consumption per category; a month in
  progress is compared with the same days of the previous month, and it shows
  "Not enough history" when the previous period has no spending. "Top 5
  categories" (`topCategoryTrend`) uses the months with entries in the last
  six. The savings rate, weekday heatmap, and budget pace charts were removed
  with their selectors.
- **Budget Health** (since 2026-11-14): Zone 1 embeds the shared
  `BudgetSummaryCard` (same numbers as the Budgets screen). The over-budget
  banner, "budget exceeded" insight, and the Planning month-end outcome
  compare budgeted day-to-day spending with day-to-day limits.
- **Share as image** goes through `lib/platform/share-image.ts`. A failure
  shows a "Couldn't share the image" toast; closing the share sheet shows
  nothing (Phase 8).

## Known gotchas
- Damping 32 can feel "sticky" on slow drags — change with care.
- `dragElastic: 0.15` produces minimal bounce; UI tweaks should preserve the
  feeling.

## Overview pane — Budget Health tile interactions (added 2026-07-05)
The **Budget Health** card (Zone 1 of
[`OverviewPane.tsx`](../../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx))
shows the shared budget summary, then these interactive tiles under "All
entries this month" (since 2026-11-14 the "Spendable Budget" tile is gone;
`tile-budget` is the status pill and chevron that link to Budgets):

| Tile | Behavior |
|------|----------|
| **Budget** (`tile-budget`) | `<Link href="/budgets">` around the status pill in the summary heading. |
| **Expenses this month** | Opens the **Expenses this month** bottom sheet listing **individual day-to-day expense transactions** (excludes commitments and savings) for `selectedMonth`, sorted by date DESC (newest first). Each row shows: date (`formatDateLabel`), note, category icon+name, and amount. Sum matches `monthlyDayToDay`. `data-testid="tile-expenses-this-month"`, list `data-testid="expense-breakdown-list"`. |
| **Commitments** | Opens the **Commitments** bottom sheet listing **individual commitment transactions** for `selectedMonth`, sorted by date DESC (newest first). Each row shows: date (`formatDateLabel`), note, category icon+name, and amount (indigo color). Sum matches `monthlyCommitments`. `data-testid="tile-commitments"`, list `data-testid="commitments-breakdown-list"`. |
| **Days Left** | Passive display. |

The **Commitments** KPI card in Zone 2 (`data-testid="kpi-commitments"`) is
also a button that opens the same commitments breakdown sheet — the two
Commitments surfaces in the Overview pane behave consistently.

Both sheets display **transaction lists where each row is clickable** — tapping
a row closes the drill-down sheet and opens the global `TransactionSheet` in
edit mode via `openEditSheet(t)` from `FinanceContext`. A 200ms delay is
inserted between closing the Radix Sheet and opening the edit sheet to avoid
focus / pointer-events conflict on Android WebView (see also `Budgets.tsx`
and `TrendsPane.tsx` which use the same pattern).

Transaction rows use:
- Date: `text-xs`, `muted-foreground`, `formatDateLabel`.
- Note: `text-sm`, `font-medium`, `foreground`; falls back to "No description".
- Category: small icon (10px) in colored rounded square + category name
  (`text-xs`, `muted-foreground`).
- Amount: `text-sm`, `font-bold`, `foreground` for expenses, `indigo-600` for
  commitments.
- `data-testid`: `expense-txn-{id}` / `commitment-txn-{id}` per row.

Both sheets reuse the existing Sheet UI: bottom sheet, `max-h-[82vh]`,
`rounded-t-2xl`. No new tokens, no new spring constants.
