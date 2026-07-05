---
id: decision-0003
title: ADR-0003 — Month-End Review flow: trigger rule, impulse heuristic, 3-month budget suggestion, no-new-dependency confetti
date: 2026-07-05
updated: 2026-07-05
status: accepted
scope: [financial-clarity]
related:
  - ../features/month-end-review.md
  - ../features/budgets.md
  - ../features/analysis.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/month-end-review.ts
  - artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndReviewFlow.tsx
  - artifacts/financial-clarity/src/components/month-end/Confetti.tsx
---

# ADR-0003 — Month-End Review flow

## Context
Users track transactions daily but rarely stop to reflect on the month or
adjust their plan for the next one. The user asked for a month-end "drill"
that (a) analyses the just-ended month, (b) walks them through creating
next-month budgets, (c) auto-triggers at month end and on first launch,
(d) leaves a home-screen notification when skipped, and (e) never
re-notifies after completion. Four design questions had to be locked in
before writing the code: **when to trigger**, **how to define "impulse
spending"**, **how to suggest budgets**, and **whether to add a
confetti dependency**.

## Decision

### 1. Trigger rule
On app launch, offer a review for the **most recent month that is fully
past OR is the current month on its last calendar day**, when that month
has at least one transaction and its review state is not `completed`.
Storage state per month:

- absent → **pending** (modal auto-opens once per session);
- `skipped:{ts}` / `dismissed:{ts}` → banner visible, modal does **not**
  auto-open (user must tap to reopen);
- `completed:{ts}` → banner hidden for that month, forever.

### 2. Impulse-expense heuristic
Top 5 single expense transactions of the month where the category `type` is
**not** `commitment` and **not** `savings`, with amount ≥ **₹500**, sorted
DESC. Empty state when none qualify.

### 3. Budget suggestion
Suggested next-month limit = `round(mean(spend across up to 3 fully-past
months for this category) / 100) * 100`. Uses whatever months (1–3) have
data. When zero history exists, no suggestion is shown and the user must
type a value or Skip the category. Existing next-month budgets are
pre-filled instead of the suggestion — never silently overwritten.

### 4. Confetti implementation
Custom framer-motion component with ~28 particles, `prefers-reduced-motion`
respected (renders nothing). **No new dependency added.** Preserves the
supply-chain policy `minimumReleaseAge: 1440` in
[.npmrc](../../../.npmrc).

## Alternatives considered

**Trigger:** Fire whenever the current month has any transaction (rejected
— feels early and repetitive mid-month). Fire only on/after the 1st of the
new month (rejected — one-day slip vs the chosen rule).

**Impulse:** Only from Leisure + Dining (rejected — too narrow; misses
impulse in Shopping / Gifts / etc.). Threshold as % of monthly income
(rejected — dynamic and hard to explain).

**Budget suggestion:** Last month × 1.05 rounded to ₹100 (rejected — noisy
if last month was atypical). Bare last-month spend (rejected — no smoothing
across seasonal months).

**Confetti:** `canvas-confetti` npm dep (rejected — new package pulls the
`minimumReleaseAge` gate and is heavier than the visual budget for a
sub-second effect).

## Consequences

- **Positive:** All logic lives in one pure module (`month-end-review.ts`)
  and one context; the modal is composable and reuses the app's existing
  Dialog, tokens, motion springs, `CategoryIcon`, `formatINR`, and
  `parseCurrencyInput`. No schema changes, no backend, no new dependency,
  no changes under `artifacts/financial-clarity/android/`.
- **Negative:** The impulse heuristic and the 3-month window are
  hand-tuned. If the user later wants percentile-based impulses or a
  configurable window, we will need to extend the API. The current
  contract intentionally hides that choice from callers.
- **Follow-ups:** If we ever add a **Settings → Notifications** surface, a
  "reset month-end-review reminders" button should clear
  `financial-clarity:month-end-review:*` keys and let the user re-run the
  drill.

## Supersedes / superseded by
None.
