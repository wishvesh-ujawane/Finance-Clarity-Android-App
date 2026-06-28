---
id: feature-analysis
title: Analysis screen (Overview / Planning / Trends)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./dashboard.md
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
