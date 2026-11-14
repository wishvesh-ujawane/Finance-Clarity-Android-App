# Fiscal Focus Product Requirements Document

**Version:** 1.1  
**Updated:** 2026-11-05  
**Status:** Product decisions recorded; implementation changes pending  
**Audience:** Individuals in India  
**Currency:** INR only  
**Platform and distribution:** Android, Google Play Store

## 1. Purpose and Authority

This document defines the product intent, scope, and acceptance criteria for the existing application. It is the product source of truth for the coding agent. The knowledge base supplies detailed architecture and implementation references.

The owner approved updating this PRD only. This document does not authorize app changes, commits, publication, or new integrations.

Requirement labels:
- **Existing:** Observed in source, not a claim of runtime verification.
- **Approved change:** Owner-selected behavior that may not yet be implemented.
- **Deferred:** Retain visibility, but do not expand or redesign now.
- **Pending review:** Requires investigation or a further owner decision.
- **Assumption:** A planning premise, not an approved requirement.

If implementation and this PRD differ, report the gap. Do not silently treat existing bugs as intended behavior or introduce unspecified features.

## 2. Problem, Value Proposition, and Target Users

### Problem

Individuals need a dependable way to record income and expenses, understand spending, plan monthly budgets, and track savings without continuous connectivity or mandatory bank integration. Missing entries, unclear balances, and inconsistent totals reduce trust.

### Value Proposition

Fiscal Focus is a local-first Android personal-finance tracker for Indian users. It combines quick manual entry, monthly budgeting, savings tracking, recurring expenses, financial analysis, and optional Google Drive backup.

The app records and analyzes financial activity. It does not execute payments or provide regulated financial advice.

### Target Users

| User | Primary need |
|---|---|
| Individual managing monthly finances | Understand income, spending, and remaining allocation |
| Budget-conscious user | Set category limits and monitor progress |
| Saver | Track Goal Savings and Emergency Fund contributions |
| User with repeated expenses | Avoid repetitive entry without creating duplicate records |
| User with intermittent connectivity | Use core tracking offline without mandatory sign-in |

**Assumption:** One person uses one local financial dataset. Shared households, multiple currencies, and separate bank-account ledgers are outside this release.

## 3. Goals and Product Boundaries

1. Make routine financial entry quick and understandable.
2. Keep equivalent financial totals consistent across screens.
3. Support monthly planning and savings visibility.
4. Preserve offline operation and optional cloud connection.
5. Explain recovery, permissions, and destructive actions clearly.
6. Prepare an Android release for Google Play without SMS access.

Drive backup is recovery, not live synchronization. Analysis is based on recorded data and local rules, not an external AI service. Forecasts are estimates, not guaranteed balances.

## 4. Core Journeys and User Stories

| Journey | User story | Expected outcome |
|---|---|---|
| First use | As a new user, I want to begin without an account. | Finish onboarding locally or optionally connect Google and inspect an available backup. |
| Record activity | As a user, I want to record income, spending, or savings quickly. | Save a valid entry and see affected totals update. |
| Correct history | As a user, I want to find and correct an entry. | Search/filter transactions, edit them, or confirm deletion. |
| Manage categories | As a user, I want to stop using an old category without losing history. | Mark it inactive; historical records remain readable. |
| Budget a month | As a user, I want category limits and spending visibility. | Create/edit budgets, inspect transactions, and copy limits to the next month. |
| Save regularly | As a saver, I want to compare contributions with targets. | Track Goal Savings and Emergency Fund progress. |
| Repeat expenses | As a user, I want active recurring expenses recorded when due. | Generate due entries once, with predictable short-month and pause behavior. |
| Understand finances | As a user, I want useful spending patterns and estimates. | Explore Overview, Planning, and Trends. |
| Review a month | As a user, I want to reflect, reconcile, and plan ahead. | Use the existing review while its redesign remains pending. |
| Recover data | As a returning user, I want to restore a known backup safely. | Preview metadata, confirm replacement, and receive a clear result. |
| Protect access | As a user, I want to restrict casual access. | Enable optional PIN and supported biometric unlocking. |

## 5. Features and Functional Requirements

### FR-01: Branding, Platform, and Onboarding

- **Approved change:** Use Fiscal Focus as the user-facing product name.
- **Approved:** Target Indian users, INR only, Android, and Google Play distribution.
- Preserve optional Google connection and the ability to begin locally.
- Show app lock before exposing financial content when protection is enabled.
- Explain restore versus continuing locally; do not imply that starting fresh automatically deletes existing records.
- Do not rename Android package identifiers, storage keys, or backup locations solely for branding without a separate compatibility plan.

### FR-02: Transactions

- Create and edit income, expense, and savings entries.
- Capture positive amount, category, date, optional note, and optional payment method.
- **Approved change (owner, 2026-11-14, D11):** The expense form has a **Paid with credit card** checkbox. A ticked expense is saved as a card purchase: it counts as consumption when made and adds to the outstanding card amount. It is offered for expenses only; unticking it on edit restores any earlier cash or bank value.
- Preserve calculator-style amount entry and Indian currency formatting.
- Store savings contributions using the reserved savings categories.
- Search by category, note, or amount; filter by type and date range.
- Confirm deletion and update affected summaries after changes.
- Preserve form values after validation/save errors.
- Date-range labels and export labels must describe the records actually included.

### FR-03: Categories

- Manage category names, icons, colors, and supported classifications.
- **Approved change:** A category that has been used cannot be deleted. Hide its Delete button and enforce the restriction in the mutation logic, not only the UI.
- **Approved change:** Show Delete only for unused, otherwise deletable categories.
- **Approved change:** Allow categories to be marked active or inactive.
- Inactivation must preserve the category and its historical references.
- Reserved/system category protections remain in place; unused status does not automatically make a system category deletable.
- **Approved (owner, 2026-11-12):** An inactive category is excluded from new-entry selection but remains visible on existing records; an edited entry keeps its current category. Treat transaction, budget, and recurring-rule references as usage; do not silently delete dependent records.
- **Approved (owner, 2026-11-12):** A category cannot be made inactive while an active (not paused) recurring rule uses it. The app names the rules and asks the user to pause them or move them to another category first; it never pauses or deletes a rule itself.

### FR-04: Dashboard and Financial Summaries

- Display lifetime balance, selected-month income and expenses, carry-forward, savings, commitments, and recent activity.
- Preserve budget alerts and navigation to supporting records.
- Describe aggregate card information without implying separate card-account accounting.
- **Approved change (owner, 2026-11-14, D11):** The "On your card" chip is tappable. It opens a card sheet with the outstanding card amount, a form to record a card bill payment (amount up to what was unpaid on the payment date and what is unpaid now; date not in the future, default today), and the card purchases and payments behind the amount. Tapping an entry opens it for editing. Bill payments are listed as "Card payment"; ordinary bills (for example recharges) remain normal spending.
- Equivalent metrics for the same period must use the approved definitions in Section 6.

### FR-05: Monthly Budgets

- Maintain one limit per category and month.
- Create/edit limits, confirm deletion, and display spent/remaining amounts and progress.
- Separate savings budgets from ordinary spending budgets.
- Open supporting category transactions from a budget.
- Copy limits to the next month, overwriting matching target categories while preserving unrelated target budgets.
- Confirm overwrite consequences. Copying is not a money transfer or unused-allowance rollover.
- **Approved change (owner, 2026-11-14, D11):** The Budgets screen and Analysis Overview show one shared budget summary: Day-to-day, Commitments, and Savings, each as "spent of limit", plus the amount spent in categories without a budget. Each type's spent plus unbudgeted amount equals that type's month total, so the summary adds up to the Dashboard expenses. The allocation strip is labelled "Not yet budgeted" and states that available money is carry-forward plus the month's income.

### FR-06: Savings

- Support Goal Savings and Emergency Fund.
- Configure monthly and annual targets and show recorded contribution progress.
- Keep global targets distinct from monthly savings budgets.
- Arbitrary named goals, withdrawals, independent account balances, and target-date editing are not added.

### FR-07: Recurring Expenses

- Configure description, amount, eligible category, day of month, start month, and active/paused state.
- Support create, edit, pause, resume, and delete.
- Preserve generated transactions when a rule is edited or deleted.
- **Approved change:** If the scheduled day does not exist, use the month's last calendar day.
- **Approved change:** Do not generate entries for paused months when the rule resumes.
- **Approved change:** When the app reopens after time away, add all due occurrences from active periods once.
- Never generate before the start month or before an occurrence is due.
- Processing or reopening repeatedly must not duplicate an occurrence.
- Generation occurs when the app processes rules; it is not a background payment or guaranteed background task.
- **Decided (owner, 2026-11-12):** Deleting a generated occurrence does not add a permanent suppression record. The forward-only generation cursor already prevents a deleted past occurrence from being recreated.

### FR-08: Analysis

- Overview: summaries, category breakdowns, budget comparisons, weekly comparisons, and rule-based alerts.
- Planning: upcoming recurring items, safe-to-spend estimates, projected ending balance, savings pace, and next-month suggestions.
- Trends: daily activity, historical income/spending, category changes versus the previous month (a month in progress is compared with the same days of the previous month), and the top five categories over the last six months. **Approved change (owner, 2026-11-14, D11):** the savings rate, weekday pattern, and budget pace charts were removed.
- Preserve Overview image export through native sharing; expose export errors visibly.
- Explain forecast assumptions and show insufficient history instead of misleading estimates.
- Confirm before suggestions overwrite existing budget limits.

### FR-09: Month-End Review

- **Existing:** Look Back, Reconcile, and Plan Ahead, with optional adjustment transactions and next-month budgeting.
- **Approved change (owner, 2026-11-12, D8):**
  - Month-end spending figures (spent, top categories, impulse rows, month-over-month change, budget suggestions) exclude card bill payments, per Section 6.
  - A **Card bill** step, shown when the card had an unpaid amount or a bill payment that month, lets the user record how much of the outstanding card amount was paid. It is saved as a card bill payment entry dated the month's last day; it lowers the outstanding card amount and is not spending. Amounts above the unpaid amount are refused.
  - **Approved change (owner, 2026-11-14, D11):** Bill payments can also be recorded from the Dashboard card sheet on the date they were paid. A payment dated after the reviewed month is not part of that month's bank balance; the Card bill step lists it and refuses to record it again (it accepts no more than what is still unpaid overall).
  - Reconcile includes the card amount still unpaid in expected bank balance, because card purchases leave the bank only when the bill is paid.
  - **Owner-approved savings reconciliation:** exclude cumulative savings held in separate accounts from expected bank balance. Ask for the actual combined savings and emergency-fund balance, and record only the confirmed difference. A decrease is classified by the user as spent or lost, or transferred back to the bank. A bank discrepancy is adjusted only with explicit confirmation; prior reconciliation records and transactions are not silently changed.
  - Plan Ahead reports a failed budget save and keeps the entered value.
- **Pending review:** Any other month-end workflow or accounting change.
- Investigate review eligibility, completion, reminders, repeat reconciliation, and adjustment duplication before proposing changes.
- Do not claim that completed reviews make months immutable.

### FR-10: SMS Removal

- **Approved change:** Remove SMS functionality from the application and its active implementation, not merely hide its entry points.
- Remove SMS screens, scanning/approval flows, parsers, native reader/plugin wiring, SMS permissions, and dedicated runtime dependencies that are no longer used.
- Keep SMS implementation and planning outside the current product scope. Do not redesign or rebuild it.
- Preserve existing financial transactions, including those originally created from SMS.
- Maintain safe handling of older backups without reactivating SMS functionality.
- Do not silently erase legacy SMS data as part of removal; propose any data purge separately.
- **Important:** SMS removal alone does not establish Google Play compliance or guarantee approval.

### FR-11: Backup, Restore, and Export

- **Deferred enhancements:** The owner considers the existing functionality sufficient for now. Preserve it; do not expand backup coverage, encryption, or recovery design in this phase.
- Preserve optional Google Drive backup, metadata preview, confirmed replacement restore, and conditional automatic backup attempts.
- Preserve CSV import/export and disclose that CSV is not a complete backup.
- Disconnecting Google must not delete local records or remote backups.
- Disclose current exclusions: reconciliation records, review completion, onboarding, lock settings, Google session, and backup preferences.
- Keep existing backup safety checks and backward compatibility. A concrete data-loss defect must still be reported rather than dismissed as deferred enhancement work.

### FR-12: Security and Support

- Preserve optional four-digit PIN, supported biometric unlocking, background locking, and failed-attempt cooldown.
- Require the current PIN to change or disable it.
- Warn clearly before forgotten-PIN recovery deletes local application data.
- Explain that the app lock does not encrypt financial storage.
- Preserve user-initiated email/WhatsApp feedback.
- **Approved change (owner, 2026-11-12, D9):** Crash reporting (Firebase Crashlytics) is removed; the app sends no diagnostics.
- **Still required before release:** A privacy policy, Google Play Data safety declarations, and store disclosures. Do not claim compliance before review.

## 6. Approved Financial Baseline

The owner approved the financial baseline below. This approval does not mean all current screens already implement it consistently.

| Concept | Definition |
|---|---|
| Income | Income-type transactions |
| Consumption spending | Expense entries excluding reserved savings and credit-card bill payments |
| Savings contributions | Expense entries in reserved savings categories |
| Monthly net | Income minus consumption minus savings |
| Carry-forward | Cumulative income minus consumption, plus confirmed savings increases and minus confirmed savings spent or lost, before the selected month |
| Lifetime balance | Cumulative income minus consumption, plus confirmed savings increases and minus confirmed savings spent or lost, through today |
| Commitments | Consumption in commitment categories |
| Outstanding card amount | Aggregate recorded card purchases minus bill payments, floored at zero |
| Budget copying | Copy limits; do not transfer money |

Carry-forward and lifetime balance retain savings and are not necessarily spendable bank cash. Savings corrections are not ordinary income, consumption, or savings contributions; transfers back to bank do not change lifetime balance. Card purchases count as consumption; paying their bill must not count that consumption twice.

Use shared financial helpers and consistent period boundaries. Do not introduce a new monetary storage model under this approval. Exact rounding, refunds, and unspecified future-date edge cases require a concrete proposal if existing rules do not resolve them.

## 7. Pages and Screens

| Screen | Purpose |
|---|---|
| Onboarding and restore choice | Begin locally or optionally connect and restore |
| Lock screen | Restrict access when protection is enabled |
| Dashboard | Financial snapshot, recent records, alerts |
| Transactions | History, search, filters, entry, export |
| Budgets | Category limits, progress, copying |
| Analysis: Overview / Planning / Trends | Breakdowns, estimates, historical patterns |
| Settings | Management and preferences |
| Categories | Category editing and active/inactive status |
| Recurring Expenses | Rule management |
| Savings Targets | Goal and emergency targets |
| Security | PIN, biometrics, locking |
| Backup and Restore | Drive recovery and CSV exchange |
| Month-End Review | Existing review plus the approved card-bill and reconcile changes (D8); other changes pending |
| Entry sheets and confirmations | Contextual editing and safe destructive actions |
| Not Found | Recover from invalid navigation |

SMS destinations are excluded from the target app. Browser support is a development convenience, not an additional release-platform commitment.

## 8. Roles and Permissions

| Role or permission | Access |
|---|---|
| Local user | Core features after unlocking, if enabled |
| Google-connected user | Same local features plus authorized Drive backup/restore |
| Locked session | No financial content until successful unlock |
| Biometric capability | Optional supported-device unlocking |
| Internet and Google authorization | Optional cloud operations |
| Share destination | Receives the export explicitly shared by the user |

There are no household roles, administrator accounts, or server-backed finance identities. Google connection is not a separate finance-account system. The target Android build must not request SMS permission.

## 9. Data Requirements

| Entity | Essential data |
|---|---|
| Transaction | ID, type, amount, category, date, note, optional payment method/merchant |
| Category | ID, name, icon, color, classification; approved addition of active/inactive status |
| Budget | ID, category, limit, month |
| Recurring rule | ID, description, amount, category, day, start month, active state, generation tracking |
| Savings targets | Goal/Emergency bucket, monthly/annual target, optional creation date |
| Reconciliation | Month, actual/expected balance, adjustment reference, timestamp |
| Review state | Per-month completion/dismissal |
| Preferences and security | Onboarding, lock configuration, connection metadata, backup preferences |

- Preserve stable identifiers and historical references.
- Existing categories should retain their current usability when migrating to active/inactive status.
- Preserve old-backup compatibility when changing category or recurring data.
- Distinguish date-only financial entries from event timestamps.
- Treat financial records, exports, and legacy SMS metadata as sensitive.
- Report persistence failures; do not equate an in-memory update with a durable save.
- SMS state is legacy compatibility data, not a new product entity or supported workflow.

## 10. Integrations and Architecture

| Integration | Purpose |
|---|---|
| Local browser/WebView storage | Core finance persistence |
| Capacitor Android | Packaging and native device capabilities |
| Google authentication and Drive | Optional backup and recovery |
| Native biometrics | Optional unlocking |
| Native file sharing | User-selected CSV/image export |
| Crash reporting | Removed 2026-11-12 (D9); no diagnostics are sent |
| Email / WhatsApp | User-initiated feedback |

No production finance backend or database service is required. The repository contains no server code. Do not add a backend to implement this scope.

## 11. Loading, Empty, and Error States

| Context | Loading | Empty | Error / recovery |
|---|---|---|---|
| Startup | Resolve local and lock state | Onboarding | Explain unreadable data without silently overwriting it |
| Transactions | Prevent duplicate submission | No entries / no matches | Preserve form values and explain failed saves |
| Categories | Save/status feedback | No eligible active categories | Explain protected deletion; preserve references |
| Budgets | Save/copy feedback | No budgets for month | Explain invalid limits or overwrite consequences |
| Analysis | Stable layout | Insufficient history | Avoid invalid percentages and misleading forecasts |
| Recurring | Processing feedback where needed | No rules | Report failure without duplicate generation |
| Backup/restore | Connection and operation progress | No backup | Preserve local usability and clearly report outcome |
| Import/export | Prevent repeated actions | No eligible records | Explain invalid input, skipped duplicates, sharing failure |
| Unlock | Attempt/cooldown feedback | Not applicable | PIN fallback and explicit reset warning |

Unavailable capabilities must explain permission, platform, or connectivity limits. Never report success when an operation failed.

## 12. Non-Functional Requirements

- **Correctness:** Equivalent financial metrics reconcile for the same data and period.
- **Offline operation:** Manual entry, history, budgets, and local analysis remain usable without sign-in or connectivity.
- **Durability:** Saved records survive restart; failures are visible.
- **Recovery:** Existing backup/restore remains functional within its documented coverage.
- **Security:** Hide financial content while locked; avoid sensitive diagnostic logging.
- **Privacy:** Disclose cloud uploads and exports accurately; the app sends no diagnostics (D9). Review required before Play Store release.
- **Accessibility:** Labeled controls, readable contrast, usable larger text, and non-color-only status indicators.
- **Mobile usability:** Respect safe areas and keep forms usable with the keyboard open.
- **Performance:** Entry/navigation remain responsive; recurring processing and backup do not freeze the interface.
- **Compatibility:** Validate the intended Android version/device range before publication.
- **Maintainability:** Reuse existing contexts, shared calculations, and UI conventions.

These are basic quality expectations, not authorization for new infrastructure or broad redesigns.

## 13. MVP Scope and Out of Scope

### In Scope

- Fiscal Focus branding; Indian audience; INR; Android/Google Play target.
- Local onboarding and optional app lock.
- Transactions, category management, and approved active/inactive behavior.
- Dashboard, budgets, and the two savings buckets.
- Recurring rules with the approved scheduling behavior.
- Existing analysis, CSV exchange, and optional Drive recovery.
- Existing month-end review, with future changes explicitly pending.
- Removal of SMS functionality and its active implementation.

### Out of Scope / Deferred

- SMS parsing, import, permissions, replacement implementation, or new SMS planning.
- Backup expansion, encryption projects, or recovery redesign at this time.
- Month-end redesign before a separate proposal and approval.
- Bank linking, payment execution, multi-device synchronization, and shared households.
- Multiple currencies, separate account ledgers, arbitrary savings portfolios, investment trading, tax filing, debt management, or financial advice.
- AI assistants, voice capture, widgets, split transactions, subscriptions, and new finance servers.
- iOS and a separately supported public web release.

Backlog ideas are not approved requirements.

## 14. Success Criteria and Release Checks

D10 means agreeing on simple ways to decide whether Fiscal Focus is ready. It does not require adding analytics.

Proposed acceptance checks:
1. A user records a transaction offline, restarts the app, and finds the saved record.
2. Equivalent totals match across screens for the same period and approved definitions.
3. Used categories cannot be deleted; inactive categories preserve readable history.
4. Recurring entries use the last valid day, skip paused months, and catch up active missed periods without duplicates.
5. No SMS screen, scan action, native reader, or SMS permission remains in the release build.
6. Existing transactions and supported older backups survive the scoped changes.
7. Core screens remain readable with larger text and usable with the keyboard open.
8. Existing backup/restore passes a representative recovery check without expanding its scope.
9. Relevant automated checks and Android device testing pass; no known critical data-loss or disclosure defect remains.
10. Play Store permissions, privacy disclosures, Data safety information, and packaging are reviewed before submission.

**Pending approval:** Exact reference devices, dataset sizes, timing thresholds, and any numeric product goals. No new telemetry collection is authorized.

## 15. Decision Register

| ID | Owner decision / status |
|---|---|
| D1 | Approved: Fiscal Focus. |
| D2 | Approved: Indian audience, INR only, Android, Google Play Store. |
| D3 | Approved: Financial baseline; unspecified precision/refund edge cases are not silently invented. |
| D4 | Approved: Last day for short months; skip paused months; catch up missed active occurrences once. |
| D5 | Approved: Remove SMS functionality and active implementation; keep SMS planning aside. |
| D6 | Approved: No deletion once used; Delete only when unused and otherwise eligible; support active/inactive. **Confirmed 2026-11-12:** pickers offer active categories only (an edited entry keeps its own); a category cannot be made inactive while an active recurring rule uses it. |
| D7 | Deferred enhancements: Keep backup requirements and existing behavior; no further expansion now. **Confirmed 2026-11-12:** no backup download size guard and no blocking pre-restore copy for now. |
| D8 | **Approved in part 2026-11-12:** month-end spending excludes card bill payments; a Card bill step records bill payments; Reconcile adds the unpaid card amount and excludes separate savings from expected bank balance; confirmed savings differences update lifetime balance as described in FR-09; Plan ahead reports budget save failures. Other month-end changes remain pending review. |
| D9 | **Decided 2026-11-12:** remove crash reporting (Firebase Crashlytics); the app sends no diagnostics. Privacy policy, Data safety form, and store disclosures still need to be completed before submission. |
| D10 | Explained: Practical readiness checks; detailed thresholds remain unapproved. |
| D11 | **Approved 2026-11-14:** "Paid with credit card" checkbox on expenses; tappable "On your card" chip with a card sheet that records bill payments on their date (amends D8's month-end-only rule); one shared budget summary on Budgets and Analysis; Trends replaces savings rate, weekday pattern, and budget pace with category changes and top-five category trend. See [ADR-0009](knowledge-base/decisions/0009-card-dues-budget-summary-trends.md). |
| Execution | Approved now: PRD update only. No app implementation changes authorized in this step. |

## 16. Supporting References

- [Knowledge Base](knowledge-base/README.md)
- [Application Architecture](knowledge-base/architecture/financial-clarity.md)
- [Application Routes](../artifacts/financial-clarity/src/App.tsx)
- [Financial State and Calculations](../artifacts/financial-clarity/src/context/FinanceContext.tsx)
- [Domain Types](../artifacts/financial-clarity/src/lib/types.ts)
- [Backup Contract](../artifacts/financial-clarity/src/lib/backup.ts)
- [Feature Backlog](knowledge-base/requirements/20260705-feature-backlog.md)

Some existing documentation differs from implementation. Neither this PRD nor the owner's acceptance of current backup behavior is a claim that runtime testing or Google Play compliance verification has already passed.