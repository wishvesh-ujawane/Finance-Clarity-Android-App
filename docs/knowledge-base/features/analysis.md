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
