---
id: bug-20261112-mobile-layout-overflow
title: Analysis tabs scroll into empty space, and cards overflow on small phones
date: 2026-11-12
updated: 2026-11-13
status: fixed
scope: [financial-clarity, analysis, dashboard, transactions, recurring-expenses, month-end-review]
related:
  - ../decisions/0009-ui-lint-and-accessibility-tooling.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Analysis.tsx
  - artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx
  - artifacts/financial-clarity/src/components/analysis/PlanningPane.tsx
  - artifacts/financial-clarity/src/components/PeriodSelector.tsx
  - artifacts/financial-clarity/src/pages/Dashboard.tsx
  - artifacts/financial-clarity/e2e/ui-layout.pw.ts
---

# Analysis tabs scroll into empty space, and cards overflow on small phones

## Symptom
Measured at 320, 360, and 412 px with synthetic data:

1. Planning and Trends could be scrolled 686–1,042 px past their last card ("infinite scrolling").
2. Upcoming Recurring Payments gave the item name 23 px at 320 px (60 px at 360 px). The name disappeared and the "Expected" line wrapped to five lines and overlapped the amount.
3. Spending by Category rows ran 18–58 px past the card's right edge; amounts and percentages were clipped.
4. The Dashboard month selector ran 2–4 px off-screen at 320 px and at 130% text.
5. The FAB covered the last transaction's amount and the last recurring rule's Delete button.
6. At 130% text, the month-end Plan ahead footer ran off-screen ("Save & next" cut off).

## Root cause
1. The swipeable Analysis slider placed all three panes in one flex row with the default `align-items: stretch`, so the row was as tall as the longest pane (Overview).
2. The upcoming table used fixed `90px 1fr 110px` columns, which leave almost nothing for the name inside page and card padding.
3. The category list sat in a `grid` with no explicit mobile column. The implicit track sized to the long category name, so the column grew wider than the card. The Planning safe-to-spend and upcoming cards had the same defect.
4. The header row did not wrap and the selector had a fixed minimum width.
5. Page bottom padding (96 px) was less than the FAB's top edge (136 px above the screen bottom).
6. Footer button rows did not wrap.

## Fix
1. The slider measures the active pane with `ResizeObserver` and takes its height; panes are `items-start`. The slider width is also observed, not only on window resize.
2. Phones use stacked rows (name over "Due in N days · category · Expected date", amount on the right); three columns from the `sm` breakpoint.
3. `grid-cols-1` with `minmax(0, …)` tracks and `min-w-0`; icons and amounts do not shrink and names truncate.
4. The header wraps, and the shared `PeriodSelector` shows `Nov 2026` below 400 px.
5. Screens with a FAB use 160 px bottom padding on mobile (DESIGN §4.1).
6. Month-end footer rows use `flex-wrap`.

## Tests
`e2e/ui-layout.pw.ts` (UI-AUDIT) audits every screen, Analysis tab, FAB sheet, row sheet, and month-end step at 320/360/412 px, at 130% text, and with empty data. It checks:

- horizontal overflow
- cut-off and off-screen text
- overlapping text
- text under the nav or FAB
- empty scroll space
- card insets
- the 11 px text minimum
- 48 px targets

It also checks Analysis tab height and the upcoming name width. All of these failed before the fix and pass after.

## Lessons
- A CSS grid with no explicit column template on mobile sizes its track to its content. Use `grid-cols-1` / `minmax(0, 1fr)` for any card that holds truncating text.
- A side-by-side swipe container needs an explicit height from the active pane.
