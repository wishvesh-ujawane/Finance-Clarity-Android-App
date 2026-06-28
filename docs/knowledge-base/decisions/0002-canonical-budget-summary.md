---
id: decision-0002
title: ADR-0002 — Canonical BudgetSummary as single source for headline budget math
date: 2026-06-28
updated: 2026-06-28
status: accepted
scope: [financial-clarity]
related:
  - ./0001-knowledge-base-bootstrap.md
  - ../features/budgets.md
  - ../features/analysis.md
  - ../bugs/20260628-budgets-analysis-divergence.md
  - ../glossary.md
source-of-truth-files:
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/pages/Budgets.tsx
  - artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx
  - artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts
  - artifacts/financial-clarity/src/lib/analysis-utils.ts
---

# ADR-0002 — Canonical `BudgetSummary` as single source for headline budget math

## Context
Two screens reported the same concept ("how am I doing against my budget this
month") with **four different numerators and denominators**:

- The Budgets screen's headline tile combined spending-budget and
  savings-budget limits into one figure and compared it to a numerator that
  used a different filter than the Analysis screen.
- The Analysis Overview "Budget Health" card divided expenses-to-date
  (sometimes net of commitments) by a denominator that sometimes included
  savings budgets and sometimes did not.
- The remaining-budget banner on Budgets and the percentage on Analysis
  could disagree by tens of thousands of rupees and by tens of percentage
  points on the same month.

A user observed June showing ₹1,85,500 total / ₹1,55,369 spent / ₹4,869 over
on the Budgets screen while the Analysis screen reported 54.7 % "on track"
for the same month — see
[bugs/20260628-budgets-analysis-divergence.md](../bugs/20260628-budgets-analysis-divergence.md).
That bug forced the question: **which definition is canonical, and where does
it live?**

The product constraint set by the user during planning (Q1–Q5 in the
orchestration turn) is:

1. **Q1 — Savings is not "spending against budget".** Savings transfers must
   be visible but never folded into the over/under math.
2. **Q2 — Commitments are budgeted spending.** They count toward the
   numerator; they are not subtracted from it.
3. **Q3 — The denominator is the non-savings budget total.** Savings limits
   are tracked separately.
4. **Q4 — Headline math is full-month, not to-date.** "Spent on budgeted" is
   the full-month sum of expense transactions in non-savings budgeted
   categories. To-date variants exist for context tiles only.
5. **Q5 — Both screens must read from the same selector.** No screen-local
   reductions allowed for headline figures.

## Decision
1. Define a **`BudgetSummary`** interface and a **`getBudgetSummary(month)`**
   selector on the Finance context as the **single source of truth** for
   headline budget math across all screens.
   ([FinanceContext.tsx L29-L37](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L29-L37),
   selector body
   [L691-L728](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx#L691-L728)).

2. Pin the canonical definitions of every field:

   | Field | Definition |
   |---|---|
   | `spendingBudget` | Sum of all **non-savings** category budget limits for the month. |
   | `savingsBudget` | Sum of all **savings** category budget limits for the month. |
   | `combinedBudget` | `spendingBudget + savingsBudget`. |
   | `spentOnBudgeted` | **Full-month** sum of expense transactions in non-savings budgeted categories, **including** commitments-with-budgets. No to-date filter. |
   | `commitmentsFullMonth` | Informational only. Full-month sum of expense transactions in commitment-typed categories. **Not** subtracted from `spentOnBudgeted` anywhere. |
   | `pctOfSpendingBudget` | `spentOnBudgeted / spendingBudget * 100`, guarded for `spendingBudget === 0`. |
   | `overUnder` | `spendingBudget - spentOnBudgeted`. Positive = remaining, negative = over. |

3. The Budgets screen
   ([Budgets.tsx](../../../artifacts/financial-clarity/src/pages/Budgets.tsx))
   and the Analysis Overview Budget Health card
   ([OverviewPane.tsx](../../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx))
   must both consume `getBudgetSummary` for their headline figures. No
   screen-local reductions for these values.

4. Status-pill thresholds remain centralised in
   [`getBudgetPill`](../../../artifacts/financial-clarity/src/lib/analysis-utils.ts#L25-L33):
   `pct ≤ 80` on track, `80 ≤ pct ≤ 100` watch, `pct > 100` over budget.

5. Labels disambiguate full-month vs to-date:
   - **Budget Health "Commitments"** tile shows
     `commitmentsFullMonth` (full-month).
   - **Key Numbers "Commitments (paid so far)"** tile shows
     `monthlyCommitmentsToDate` (to-date).

## Alternatives considered
- **Keep per-screen reductions and add an integration test that diffs the
  two numbers.** Rejected: the test would tell us the screens disagreed but
  not which definition is right. The user's Q1–Q5 settle that; pinning the
  selector enforces it for future code.
- **Subtract commitments from `spentOnBudgeted`** to surface "day-to-day"
  spending separately. Rejected: the user explicitly chose to treat
  commitments-with-budgets as budgeted spending (Q2). A separate
  `commitmentsFullMonth` tile preserves visibility without bending the
  numerator.
- **Fold savings into `combinedBudget` and use that as the denominator.**
  Rejected: savings is allocated income, not budgeted spending (Q1).
  `savingsBudget` is exposed for display only; the Budgets headline shows it
  as a `+ ₹X savings` sublabel beside `spendingBudget`.
- **Use to-date numerator for the headline** to match the in-progress feel
  of the Analysis screen. Rejected: pre-materialised recurring transactions
  in the current month would skew the headline. Full-month is more stable
  and matches user expectation (Q4).

## Consequences
**Positive**
- Both screens render the same figure for the same month. The user-reported
  June divergence cannot recur for the same input data.
- Adding a new surface that needs headline budget math is a one-liner:
  call `getBudgetSummary(month)`.
- Definitions live in code (the selector) and in this ADR. Future PRs that
  touch headline budget math must update both.

**Negative**
- The selector is `O(transactions + budgets)` per call. Memoised at each
  call site via `useMemo`; not a hot path.
- The "Commitments" wording appears in two places with two different scopes
  (full-month and to-date). Labels disambiguate but this is a permanent
  cognitive cost.

**Follow-ups (not blocking)**
- Add an integration test that mounts both screens with the same fixture and
  asserts identical headline figures.
- Consider exposing a `dayToDaySpent = spentOnBudgeted - commitmentsFullMonth`
  derived field if a future surface needs it; do not add until a real
  consumer exists.

## Supersedes / superseded by
- Supersedes: none. This is the first ADR pinning Financial Clarity money
  math.
- Superseded by: none.
