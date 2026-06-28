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
  - ./budgets.md
  - ../decisions/0002-canonical-budget-summary.md
  - ../bugs/20260628-budgets-analysis-divergence.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Analysis.tsx
  - artifacts/financial-clarity/src/components/analysis/
  - artifacts/financial-clarity/src/lib/analysis-utils.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
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

## Budget Health card (Overview)

Rendered in the Overview pane under the "How am I doing this month?" zone
([OverviewPane.tsx](../../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx),
`data-testid="monthly-budget-health"`).

**The card reads from the same `getBudgetSummary(month)` selector as the
Budgets screen** ([FinanceContext.tsx L691-L728](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L691-L728)),
exposed via [`useAnalysisShared`](../../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts)
as `budgetSummary`. Screen-local reductions for headline budget figures are
forbidden; see [ADR-0002](../decisions/0002-canonical-budget-summary.md).

### Header
- **Status pill** (right) — driven by
  [`getBudgetPill(budgetSummary.pctOfSpendingBudget)`](../../../artifacts/financial-clarity/src/lib/analysis-utils.ts#L25-L33).
  Hidden when `spendingBudget === 0`. Thresholds:
  - `pct ≤ 80` → emerald **"On track"**.
  - `80 < pct ≤ 100` → amber **"Watch"**.
  - `pct > 100` → red **"Over budget"**.
- **Percentage label** — `"<pct.toFixed(1)>% spent"` (capped at 999 for
  display). Shows `"No budget configured"` when `spendingBudget === 0`.

### Four tiles
1. **Budget** — `budgetSummary.spendingBudget`. Sum of **non-savings**
   category budget limits for the month. Savings limits are excluded by
   design.
2. **Spent on budgeted** — `budgetSummary.spentOnBudgeted`. **Full-month**
   sum of expense transactions in non-savings **budgeted** categories,
   **including** commitments-with-budgets. Renders red when `overUnder < 0`.
   (This tile was previously labelled "Expenses this month"; that label was
   misleading because it used a different numerator than the percentage.)
3. **Commitments** — `budgetSummary.commitmentsFullMonth`. Informational
   only. Full-month sum of expense transactions in **commitment-typed**
   categories. **Not** subtracted from the numerator anywhere. Note: this is
   distinct from the **Key Numbers "Commitments (paid so far)"** tile below,
   which uses `monthlyCommitmentsToDate`.
4. **Days Left** — `daysLeftInMonth` from `useAnalysisShared`. Not part of
   the budget selector.

### Progress bar and "Remaining budget" line
- Bar colour by `budgetSummary.pctOfSpendingBudget`: ≤ 80 emerald, ≤ 100
  amber, > 100 red. Width clamped to [0, 100].
- Footer line shows `formatINR(|budgetSummary.overUnder|)` with emerald when
  `overUnder ≥ 0`, red otherwise.

### Budget-exceeded hero
When `budgetSummary.overUnder < 0` the pane renders a red hero link above
the Budget Health card (`data-testid="budget-exceeded-hero"`) with the over-amount
and a deep-link to `/budgets`. Driven by the same `overUnder` field; cannot
disagree with the card.

## Commitments terminology — full-month vs to-date

The Overview pane shows **two** "Commitments" figures and they intentionally
use different scopes:

| Tile | Source | Scope |
|---|---|---|
| **Budget Health → "Commitments"** | `budgetSummary.commitmentsFullMonth` | **Full month**. Includes future-dated transactions in the current month (e.g. pre-materialised recurring). |
| **Key Numbers → "Commitments (paid so far)"** | `monthlyCommitmentsToDate` from [useAnalysisShared](../../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts) | **To-date**. Filtered to `date <= today`. |

The wording was sharpened in commit `bb1afa7` to disambiguate. The full-month
figure belongs next to the headline because the headline numerator is also
full-month (see
[ADR-0002 decision point Q4](../decisions/0002-canonical-budget-summary.md#context)).
The to-date figure belongs in Key Numbers because it answers "how much have
I actually paid so far this month".
