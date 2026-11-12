---
id: decision-0007
title: ADR-0007 — Owner decisions D6–D9 — recurring rules block inactivation, month-end card bill payments, crash reporting removed
date: 2026-11-12
updated: 2026-11-12
status: accepted
scope: [financial-clarity, categories, recurring, month-end, privacy, android]
related:
  - ./0006-category-status-and-backup-v5.md
  - ./0003-month-end-review-flow.md
  - ../features/month-end-review.md
  - ../features/categories.md
source-of-truth-files:
  - docs/PRD.md
  - artifacts/financial-clarity/src/lib/category-rules.ts
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/lib/month-end-review.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndCardBillCard.tsx
  - artifacts/financial-clarity/src/__tests__/crash-reporting-removed.test.ts
---

# ADR-0007 — Owner decisions D6–D9

## Context

The Phase 1–10 review left owner decisions open (PRD FR-03, FR-07, D7, D8,
D9, CI pinning). On 2026-11-12 the owner answered them:

- Used categories are never deleted, only made inactive so they cannot be
  used in future; unused categories can be deleted.
- A category with an active recurring rule must not be made inactive until
  the user pauses or moves the rule.
- Deleting a generated recurring occurrence does not suppress it
  permanently.
- Month-end must not count card bill payments as spending. The user already
  marks card purchases ("Credit Card (due)"); month-end should let them say
  how much card debt they cleared from their income and balance.
- Reconcile should add the unpaid card amount to the bank balance it
  expects, and the Plan ahead step should report budget save failures.
- Remove crash reporting instead of adding consent and scrubbing.
- No backup size guard or blocking pre-restore copy for now; keep CI actions
  pinned to major versions.

## Decision

1. `setCategoryActive(id, false)` is refused while any active (not paused)
   recurring rule uses the category. The message names the rules and says to
   pause or move them first. The app never pauses or deletes a rule itself.
   Paused rules do not block.
2. Month-end figures use the shared PRD §6 consumption rule
   (`isConsumptionExpense`), so card bill payments are not spending.
3. A **Card bill** step appears between Look back and Reconcile when the card
   had an unpaid amount or a bill payment in the reviewed month. It records a
   payment with `FinanceContext.recordCardBillPayment(month, amount)`:
   an expense with `paymentMethod: 'credit-card-payment'`, category `other`,
   note "Card bill payment", dated the month's last day. Amounts above the
   unpaid amount at month end are refused. No new field, storage key, or
   schema version is needed; the value already existed in the type,
   validator, and backups.
4. Reconcile's expected bank balance is
   `expectedBankBalanceAtEndOf(month)` = balance through the month + card
   amount still unpaid at month end. Card purchases leave the bank only when
   the bill is paid.
5. The Plan ahead budget step checks `addBudget`'s result, stays on the
   category, keeps the value, and shows the error.
6. Firebase Crashlytics is removed: both `@capacitor-firebase` packages,
   `lib/crashlytics.ts`, its start-up call, the Crashlytics Gradle plugin and
   classpath, and the Capacitor module links. A guard test prevents it from
   returning. The `google-services` Gradle plugin stays because Google
   sign-in configuration may rely on it.

## Alternatives considered

- Pause the rules automatically with a confirmation. Rejected by the owner
  in favour of asking the user to pause or move them.
- A new reserved "Card payment" category. Rejected: it needs a migration and
  backup handling; `paymentMethod` already identifies the entry and `other`
  is always active.
- A date picker for the bill payment. Rejected for now: the month's last day
  matches the reconcile cut-off and the existing adjustment entries.
- Recording bill payments from the Add entry sheet as well. The owner chose
  month-end only.
- Keep Crashlytics with opt-in consent and scrubbing. The owner chose removal,
  which also simplifies the Data safety answers.

## Consequences

- Positive: the Dashboard card amount can now go down; month-end totals
  match the rest of the app; reconcile no longer reports an unpaid card bill
  as an "over-logged" gap; no diagnostics leave the device.
- Negative: bill payments made after month end must be recorded in the next
  month's review. In lists a payment shows as "Other" with the note
  "Card bill payment" until the DESIGN §4.6 "Card payment" row label is
  built. Crash data is no longer available to the developer.
- Follow-ups: privacy policy and Play Data safety form; DESIGN §4.6 row
  label; run `cap sync android` so the generated plugin list drops Firebase.

## Supersedes / superseded by

Amends ADR-0006 decision 2: the edited-entry rule is now owner-confirmed, and
"recurring generation for an existing active rule is not affected" is
replaced by decision 1 above (a category with an active rule cannot become
inactive).
