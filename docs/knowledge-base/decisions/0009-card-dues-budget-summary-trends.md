---
id: decision-0009
title: ADR-0009 — Card dues from the Dashboard, one shared budget summary, new Trends cards
date: 2026-11-14
updated: 2026-11-14
status: accepted
scope: [financial-clarity, transactions, dashboard, month-end, budgets, analysis]
related:
  - ./0007-owner-decisions-d6-d9.md
  - ../features/dashboard.md
  - ../features/transactions.md
  - ../features/budgets.md
  - ../features/analysis.md
  - ../features/month-end-review.md
source-of-truth-files:
  - docs/PRD.md
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/lib/domain/budgets.ts
  - artifacts/financial-clarity/src/lib/domain/analysis.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/components/TransactionSheet.tsx
  - artifacts/financial-clarity/src/components/card/CardDuesSheet.tsx
  - artifacts/financial-clarity/src/components/BudgetSummaryCard.tsx
  - artifacts/financial-clarity/src/components/analysis/TrendsPane.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndCardBillCard.tsx
---

# ADR-0009 — Card dues from the Dashboard, one shared budget summary, new Trends cards

## Context

On 2026-11-14 the owner reviewed live screenshots and reported:

1. The Dashboard showed "₹1,499 on your card", but the chip was not tappable
   and there was no way to change the amount.
2. The Budgets screen and the Analysis "Budget Health" card showed different,
   hard-to-read numbers. Budgets added day-to-day, commitment, and savings
   limits together and counted only budgeted categories. Analysis compared
   day-to-day limits with all day-to-day spending, including categories with
   no budget. The "Surplus" strip was a third figure.
3. The Trends charts "Monthly savings rate", "When do you spend most?", and
   "Budget usage this month" were not useful.
4. A "Paid with credit card" checkbox on Add expense was still missing. The
   payment-method picker had been switched off with `{false && …}` (audit
   F-16), so card purchases could not be recorded by hand.

ADR-0007 limited card bill payments to the month-end Card bill step.

## Decision

1. **Checkbox.** The expense form has a "Paid with credit card" checkbox. It
   writes the existing `paymentMethod: 'credit-card'`. It is shown for
   Expense only, and unticking it on edit restores any earlier cash or bank
   value. The disabled picker block is removed.
2. **Card sheet.** The "On your card" chip is a button. It appears once any
   card entry exists and opens `CardDuesSheet`, which shows the outstanding
   amount, records a bill payment with
   `FinanceContext.recordCardBillPaymentOn(date, amount)`, and lists card
   purchases and payments, which can be tapped to edit. The payment is the
   same row as the month-end payment, dated the day it was paid.
3. **Payment limit.** `cardBillPaymentLimit(date)` is the smaller of what was
   unpaid on `date` and what is unpaid now. Both entry points use it, so a
   payment recorded from the Dashboard in early December cannot be recorded
   again in November's month-end review. Reconcile is unchanged: a payment
   after month end is not part of that month's bank balance. The Card bill
   step lists such payments and says not to record them again.
4. **Budget summary.** `budgetSummary` in `lib/domain/budgets.ts` returns,
   for day-to-day, commitments, and savings: `limit`, `spent` (the same rule
   as each budget card), `unbudgeted`, and `count`. `getBudgetBreakdown`
   returns it. Budgets and Analysis both render it with `BudgetSummaryCard`.
   `spent + unbudgeted` equals each type's month total, so the summary adds
   up to the Dashboard Expenses. The over-budget banner, insights, and the
   Planning month-end outcome use the day-to-day bucket. The allocation strip
   is renamed "Not yet budgeted".
5. **Trends.** The three charts are removed together with their selectors
   (`consumptionByWeekday`, `dayToDayPaceByDay`). Two cards are added:
   "What changed vs last month" (`categorySpendChanges`; a month in progress
   is compared with the same days of the previous month) and
   "Top 5 categories" (`topCategoryTrend`).
6. **Rows.** Card bill payments show as "Card payment" in neutral color.
   Card purchases get a "Card" badge. Ordinary bills such as recharges keep
   their category and remain spending.

No new field, storage key, schema version, dependency, or permission.

## Alternatives considered

- Keep bill payments month-end only (ADR-0007). Rejected by the owner: the
  amount must be changeable from the chip.
- Reuse the three-option Cash/Bank/Card picker. The owner asked for a single
  checkbox; cash and bank values on older entries are preserved.
- Match bill payments to individual purchases ("unpaid purchases"). Rejected:
  the PRD defines an aggregate card amount, not card-account accounting.
- Compare a month in progress with the full previous month. Rejected: it
  would always show "spending less" early in the month.
- Other Trends replacements (spending split by type, lifetime balance line)
  were offered; the owner chose category changes and the top-5 trend.

## Consequences

- Positive: card dues can be cleared at any time; month-end cannot
  double-record them; both budget screens agree and add up to the Dashboard.
- Negative: the payment limit uses entries dated after the payment date, so a
  back-dated payment can be refused if later payments already cleared the
  card. Editing a bill payment's amount in the transaction sheet is not
  checked against the limit (existing behavior).
- Follow-ups: device check of the chip, sheet, and checkbox at 130% font
  size; a What's New entry with the next deployment (AGENTS §13.1).

## Supersedes / superseded by

Amends [ADR-0007](./0007-owner-decisions-d6-d9.md) decision 3: bill payments
are no longer recorded from month-end only.
