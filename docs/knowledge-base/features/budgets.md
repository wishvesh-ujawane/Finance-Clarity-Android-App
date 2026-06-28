---
id: feature-budgets
title: Budgets screen
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./fab.md
  - ./savings-goals.md
  - ./categories.md
  - ./analysis.md
  - ../decisions/0002-canonical-budget-summary.md
  - ../bugs/20260628-budgets-analysis-divergence.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Budgets.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/finance-utils.ts
  - artifacts/financial-clarity/src/lib/analysis-utils.ts
---

# Budgets screen

## User-visible behavior
Monthly budgets and savings targets. Header shows "Monthly · Budgets". A
full-width "Transfer Budget to Next Month" button sits above the content. The
**Surplus bar** (dark blue `bg-[hsl(222,65%,13%)]`) summarises remaining
allocation as `Surplus · ₹X of ₹Y` plus a percentage and an animated progress
bar coloured red / amber / emerald by threshold. Two summary cards
(total budget / spent on budgeted) sit in a grid below.

The **budget list** renders one card per budget with category icon, name,
progress bar (red if over, amber 75–100%, category colour otherwise), edit
button (pencil), and in-edit-mode inline ₹ input plus checkmark / cancel /
delete buttons.

A separate **savings targets** section uses a PiggyBank icon and the same
layout, with green progress when on target and amber 70–100 %. See
[savings-goals.md](./savings-goals.md).

## Entry points
- Route: `/budgets`.
- File: [pages/Budgets.tsx](../../../artifacts/financial-clarity/src/pages/Budgets.tsx).

## State & data sources
Reads / writes via [FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx):
`budgets`, `addBudget`, `updateBudget`, `deleteBudget`,
`transferBudgetsToMonth`, `getSpentForCategory`, `getCarryForward`,
`getTotalIncome`, `selectedMonth`.

## Interactions
- **Transfer Budget to Next Month** (lines 52–67 of `Budgets.tsx`) — disabled
  when `currentMonthBudgets.length === 0`; opens an `AlertDialog` confirming
  the bulk copy.
- **Surplus bar** (lines 104–113) — purely informational.
- **Add Budget sheet** — opened by FAB. Registered via
  `useFabAction(openAddBudget, 'Add budget', 'fab-add-budget')`. Contains
  category select + limit input + Cancel/Save.
- **Edit-in-place** — pencil → inline `₹` input → checkmark/X/delete.
- **Category transactions sheet** — `openCategoryTransactions(categoryId)`
  opens a sheet listing the transactions that count toward that budget.

## Edge cases & empty states
- Empty state: plus-icon tile + "No budgets set".
- Over-allocated month: surplus bar flips to red and shows "over-allocated"
  status instead of "Surplus".

## Cross-feature dependencies
- [categories.md](./categories.md) — budgets are keyed by `categoryId`.
- [savings-goals.md](./savings-goals.md) — rendered in the same screen but
  managed via its own context entries.

## Known gotchas
- Surplus bar uses a **hardcoded** dark blue `hsl(222,65%,13%)` instead of a
  Tailwind theme token; any palette change must touch this directly.

## Math

All headline figures on this screen are derived from the canonical
`getBudgetSummary(month)` selector on the Finance context
([FinanceContext.tsx L29-L37](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L29-L37),
implementation
[L691-L728](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L691-L728)).
**The Analysis Overview "Budget Health" card reads from the same selector**
— see [analysis.md → Budget Health card](./analysis.md#budget-health-card-overview).
Screen-local reductions for these values are forbidden; see
[ADR-0002](../decisions/0002-canonical-budget-summary.md).

### Headline two-tile grid
Rendered only when the month has at least one non-savings budget
(`budgetsWithData.length > 0`).

- **Left tile — "<Month> Month Budget"**: big number is
  `budgetSummary.spendingBudget` (sum of **non-savings** category budget
  limits for the month). When `savingsBudget > 0`, a sublabel reads
  `"+ ₹<savingsBudget> savings"`. Savings is **never** folded into the big
  number.
- **Right tile — "Spent on budgeted"**: big number is
  `budgetSummary.spentOnBudgeted` — the **full-month** sum of expense
  transactions in non-savings **budgeted** categories. Commitments-with-budgets
  are **included** in this numerator (they are budgeted spending); they are
  not subtracted anywhere on this screen.

### Over / under banner
Sublabel beneath the "Spent on budgeted" tile.

- Denominator: `budgetSummary.spendingBudget` (non-savings budgets only).
- Driver: `budgetSummary.overUnder = spendingBudget - spentOnBudgeted`.
- Display:
  - `overUnder > 0` → `"₹<overUnder> remaining"` (emerald).
  - `overUnder < 0` → `"₹<|overUnder|> over"` (red).
  - `overUnder === 0` → `"On budget"`.

The savings budget is **shown separately** as the `"+ ₹X savings"` sublabel
on the left tile and is **never** part of the over/under math. This is the
locked product rule pinned in
[ADR-0002 decision points Q1 and Q3](../decisions/0002-canonical-budget-summary.md#context).

### Status thresholds
Same as the Analysis Budget Health pill. Defined in
[`getBudgetPill`](../../../artifacts/financial-clarity/src/lib/analysis-utils.ts#L25-L33):
- `pct ≤ 80` → emerald **"On track"**.
- `80 < pct ≤ 100` → amber **"Watch"**.
- `pct > 100` → red **"Over budget"**.
Where `pct = budgetSummary.pctOfSpendingBudget`.

### Distinct from the Surplus bar
The dark-blue Surplus bar uses a different math entirely: it compares
**allocated budgets** against **available income + carry-forward**, not
spent-vs-budgeted. See `surplusInfo` in
[Budgets.tsx](../../../artifacts/financial-clarity/src/pages/Budgets.tsx).
Do not confuse "surplus" (allocation headroom) with "over/under" (spending
performance).
