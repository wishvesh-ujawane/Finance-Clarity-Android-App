---
id: feature-month-end-review
title: Month-End Review flow (analysis + guided budget setup)
date: 2026-07-05
updated: 2026-07-05
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ../decisions/0003-month-end-review-flow.md
  - ./dashboard.md
  - ./budgets.md
  - ./analysis.md
  - ./onboarding.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/month-end-review.ts
  - artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndReviewFlow.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndAnalysisCard.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndBudgetCard.tsx
  - artifacts/financial-clarity/src/components/month-end/Confetti.tsx
  - artifacts/financial-clarity/src/components/MonthEndReviewBanner.tsx
  - artifacts/financial-clarity/src/App.tsx
  - artifacts/financial-clarity/src/pages/Dashboard.tsx
---

# Month-End Review

## User-visible behavior
A once-per-month, two-step guided modal that helps the user reflect on the
just-ended month and plan next month's budget.

- **Step 1 — Look back.** "Your <Month> in numbers" hero, three KPI tiles
  (Net saved · Savings rate · Spend vs last month), Income vs Spent summary
  strip, Top spending categories list, Impulse expenses list, and a
  two-tile Savings split (Emergency Fund · Goal Savings).
- **Step 2 — Plan ahead.** A one-category-at-a-time walkthrough of every
  budgetable category (commitment → expense → both → savings, then A→Z).
  Each step shows the category tile, a suggested monthly limit based on
  the last 3 months, and a large ₹ input. Buttons: **Skip category** and
  **Save & next** (final step becomes **Save & finish**).
- A short confetti burst plays when the modal opens and again on
  completion. Confetti respects `prefers-reduced-motion` and renders
  nothing in that case.
- Skip / Close (X) both close the modal and leave a **home-screen banner**
  on the Dashboard prompting the user to run the review. Only **Save &
  finish** on step 2 clears the banner for the reviewed month.

## Trigger / entry points
Auto-opens once per session, gated by the security lock and onboarding
flow — see `AppLayout.setSuppressAutoOpen` in
[App.tsx](../../../artifacts/financial-clarity/src/App.tsx).

The pending month is chosen by `shouldAutoOpenReview` in
[month-end-review.ts](../../../artifacts/financial-clarity/src/lib/month-end-review.ts):

- The most recent month that (a) is fully in the past **or** is the current
  month **and** today is its last calendar day, (b) has at least one
  transaction, and (c) is not marked `completed`.
- Skipped / dismissed months still show the banner but do not auto-open —
  the user must tap **Start review** on the banner.
- If nothing qualifies (fresh user, or every past month completed), the
  banner is hidden.

Manual entry: `MonthEndReviewBanner` CTA on
[Dashboard.tsx](../../../artifacts/financial-clarity/src/pages/Dashboard.tsx).

## State & data sources
`MonthEndReviewContext` in
[MonthEndReviewContext.tsx](../../../artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx)
mediates the flow. It reads `transactions` + `lastChangedAt` from
`FinanceContext` and exposes `{ pendingMonth, pendingState, isOpen, open,
skip, dismiss, complete, setSuppressAutoOpen }`.

Persistence: **localStorage only.** One key per month under the existing
`financial-clarity:` namespace:

| Key | Value | Meaning |
|-----|-------|---------|
| `financial-clarity:month-end-review:{YYYY-MM}` | absent | Pending — modal auto-opens |
| ↳ | `skipped:{ts}` | User pressed Skip — banner still shown |
| ↳ | `dismissed:{ts}` | User pressed X — banner still shown |
| ↳ | `completed:{ts}` | User finished step 2 — banner hidden forever |

The Analysis snapshot is computed by
`computeReviewSnapshot(month, transactions, categories)` — a pure function.
Budget suggestions come from `suggestBudgetForCategory(categoryId,
reviewMonth, transactions, window=3)`.

## Interactions
- **Auto-open** — on app launch, `useEffect` in
  [MonthEndReviewContext.tsx](../../../artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx)
  fires when `suppressAutoOpen` is false and `pendingState === 'pending'`.
- **Step 1 → Step 2** — footer button **Continue → Plan next month** in
  [MonthEndReviewFlow.tsx](../../../artifacts/financial-clarity/src/components/month-end/MonthEndReviewFlow.tsx).
  Slide uses framer-motion spring `stiffness: 320, damping: 32` to match
  the Analysis pane swipe.
- **Step 2 back to Step 1** — footer button `← Back to analysis`
  (does **not** discard budget inputs already saved via `addBudget`).
- **Budget step forward/back** — `AnimatePresence` inside
  [MonthEndBudgetCard.tsx](../../../artifacts/financial-clarity/src/components/month-end/MonthEndBudgetCard.tsx)
  swaps the current step; `Back`, `Skip category`, `Save & next`,
  `Save & finish`.
- **Input** — validated through `parseCurrencyInput` from
  [currency-utils.ts](../../../artifacts/financial-clarity/src/lib/currency-utils.ts).
  `Save & next` is disabled until the parsed value is > 0.
- **Skip / X** — both call `dismiss()` / `skip()` on the context, which
  write `dismissed:{ts}` / `skipped:{ts}` and close the modal. The
  Dashboard banner remains until `completed:{ts}` is written.
- **Confetti** — `Confetti` component in
  [Confetti.tsx](../../../artifacts/financial-clarity/src/components/month-end/Confetti.tsx)
  fires on `fireKey` bump (open + finish). No new dependency.

## Edge cases & empty states
- **No categories to budget** — step 2 renders a helper message with a
  Close button.
- **No 3-month history for a category** — the suggestion is `null`; the
  input is empty with a hint "No history yet — enter what feels right for
  next month." Save & next stays disabled until the user types a value.
- **Fewer than 3 past months of history** — suggestion averages whatever
  months (1 or 2) have data.
- **Existing budget already set for next month** — the input is pre-filled
  with the existing limit and labelled "Existing budget: ₹X". Nothing is
  overwritten silently. Skip leaves it unchanged.
- **No impulse expenses ≥ ₹500** — empty state reads
  "Nice — no impulse spikes this month."
- **No expenses at all** — Top categories shows "No expenses in this
  month." Save & next remains available in step 2.
- **Lock screen or onboarding active** — auto-open is suppressed. The
  banner still appears once the app becomes reachable.
- **Reduced motion** — confetti and slide animations degrade to no-op /
  minimal transitions.

## Cross-feature dependencies
- [budgets.md](./budgets.md) — step 2 writes budgets via
  `FinanceContext.addBudget({ categoryId, limit, month: nextMonth })`.
- [analysis.md](./analysis.md) — reuses the same money-aggregation
  conventions (savings-category ids excluded from expense totals).
- [dashboard.md](./dashboard.md) — hosts the banner above
  `ConnectDriveBanner`.
- [onboarding.md](./onboarding.md) — never runs simultaneously; onboarding
  wins.

## Impulse-expense heuristic
Top 5 single expense transactions of the month with:
- category `type` **not** `commitment` and **not** `savings`; AND
- amount ≥ **₹500**;
- sorted by amount DESC.

See [`decisions/0003-month-end-review-flow.md`](../decisions/0003-month-end-review-flow.md).

## Known gotchas
- Banner appears only on the Dashboard, not on other screens — this is
  intentional; the Dashboard is the landing surface.
- Suggested budget uses `round(avg / 100) * 100`; users can override every
  value including savings categories.
- Auto-open fires exactly **once per app session** — after Skip / X, the
  user must tap the banner to reopen (this is the point of the banner).
- Storage keys are namespaced per month; there is no bulk-clear utility —
  users can wipe them from DevTools or via a full localStorage clear.

## Related changes
- Introduced in `feature/month-end-review` on 2026-07-05.
