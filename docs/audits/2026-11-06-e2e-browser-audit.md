---
date: 2026-11-06
scope: "end-to-end browser audit — usefulness, security, bugs, and the home-PC APK build path"
auditor: coding-agent (AGENTS.md)
status: complete
oracle-consulted: false
manual-walkthrough: "replaced by scripted Playwright exploration (synthetic data)"
dev-server: "agent-started:http://127.0.0.1:5199 (stopped after the run)"
features-covered: [onboarding, dashboard, transactions, budgets, analysis, categories, recurring-expenses, savings, backup, csv, security, month-end-review, android-build]
---

# End-to-end browser audit (2026-11-06)

## Summary

Fiscal Focus works as an offline expense tracker in the browser: onboarding, transactions,
budgets, recurring expenses, analysis, and month-end review all run without crashes, and the
Dashboard follows the PRD §6 baseline. It is **not yet safe for daily personal use**: CSV
export/import can corrupt money figures, the lock screen leaves financial content mounted, and
Drive backup can overwrite a good backup with empty data.

Counts by severity (rubric in [README.md](./README.md#severity-rubric)):
**P0=4, P1=13, P2=4, P3=5.** Two further items (R-01, R-02) are resolved in this change.

## Evidence gathered

Branch `chore/remove-dead-code`, working tree (Phase 1–2 cleanup uncommitted):

| Check | Result |
|---|---|
| `pnpm run typecheck` | Pass |
| `pnpm --filter @workspace/financial-clarity run test:run` | Pass — 75/75 |
| `pnpm run build` | Pass — main JS chunk 1,207.57 kB |
| `pnpm --filter @workspace/financial-clarity run test:e2e` (before) | Pass — 12/12 |
| Exploratory Playwright scripts, 390×844 touch + 1280×800, synthetic data | Findings below |
| New reproductions [`audit-2026-11-06.pw.ts`](../../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) with `test.fail()` stripped | 8/8 fail on the defect itself |
| `test:e2e` (after) | Pass — 20 (12 + 8 expected failures), 8 skipped |

Not done: Android build (Gradle is blocked on this network; JDK 25 and no SDK here), on-device
testing, Google Drive sign-in (Google hosts blocked in tests).

## Findings

### P0 — data loss, wrong money, security

| ID | Finding | Evidence | Test |
|---|---|---|---|
| F-01 | **CSV export does not neutralise formula cells.** A note `=HYPERLINK(...)` is exported verbatim (AGENTS.md §9). | [csv.ts](../../artifacts/financial-clarity/src/lib/csv.ts) `escapeCsvCell` | CSV-001 |
| F-03 | **CSV round-trip corrupts savings.** Re-importing the app's own export created a second "Emergency Fund" category (type `expense`) and a duplicate ₹5,000 transaction now counted as consumption ("Spent today" rose by ₹5,000). Import matches categories by `name\|type`; savings and commitment categories never match a CSV `expense` row. | [BackupRestore.tsx](../../artifacts/financial-clarity/src/pages/BackupRestore.tsx) lines 63–85 | CSV-002 |
| F-04 | **Locked app keeps financial content mounted.** While locked, `main` and `balance-amount` (`₹74,853`) were in the DOM and accessibility tree under a 95%-opaque overlay; Tab moved focus out of the lock screen. Violates "Locked means not rendered" (AGENTS.md §9). | [App.tsx](../../artifacts/financial-clarity/src/App.tsx) `AppLayout` renders `<Switch>` regardless of `isLocked`; [LockScreen.tsx](../../artifacts/financial-clarity/src/components/LockScreen.tsx) has no focus trap | SEC-004, SEC-006 |
| F-05 | **"Back up now" overwrites the single Drive backup without comparison.** On a fresh, empty install a manual backup replaces the only good backup; there is no remote snapshot before overwrite (only before restore). | [BackupContext.tsx](../../artifacts/financial-clarity/src/context/BackupContext.tsx) `backupNow` | Not browser-testable (Drive) |

### P1

| ID | Finding | Evidence | Test |
|---|---|---|---|
| F-02 | **CSV import applies immediately** (no preview/confirmation) and accepts impossible dates (`2026-13-45`; check is format-only). | `BackupRestore.tsx`; `csv.ts` `parseTransactionsCsv` | CSV-003, CSV-004 |
| F-06 | **Debug APKs expose all data over USB.** Debug builds are debuggable: `adb run-as` and the WebView inspector read local storage, bypassing `allowBackup="false"`. The release build type has no signing config. | [app/build.gradle](../../artifacts/financial-clarity/android/app/build.gradle) | Documented in [BUILD_ON_HOME_PC.md](../BUILD_ON_HOME_PC.md) §0.3, §6 |
| F-07 | **A category with transactions can be deleted**; its transactions show "Unknown" (PRD FR-03, D6). | `FinanceContext.tsx` `deleteCategory` has no usage check; `Categories.tsx` always shows Delete | CAT-002 |
| F-08 | **Storage write failures are swallowed** (already tracked as P4-1 in the [phase 3–4 review](./2026-11-06-cleanup-phases-3-4-review.md)). | — | — |
| F-09 | **Failed-PIN cooldown resets on reload/restart.** Attempts and cooldown live in React state; a 4-digit PIN is a 10,000-value space. | `LockScreen.tsx` | SEC-005 |
| F-10 | **Totals differ across screens for the same month.** Dashboard Expenses ₹19,200 (consumption) vs Transactions "Expenses" and Analysis "Total Spent" ₹24,200 (includes the ₹5,000 savings). Confirms P3-3 of the phase 3–4 review. | Dashboard vs Transactions vs Analysis | — |
| F-11 | **Analysis shows misleading figures.** Planning projected −₹26,000 on day 6 by extrapolating a one-off rent payment; Smart Insights said "No spend logged this month yet" with spending present; Budget Health showed "No budget configured" next to "Over budget ₹24,200". PRD FR-08 requires "insufficient history" instead of misleading estimates. | [PlanningPane.tsx](../../artifacts/financial-clarity/src/components/analysis/PlanningPane.tsx) lines 83–95; [OverviewPane.tsx](../../artifacts/financial-clarity/src/components/analysis/OverviewPane.tsx) line 316 fallback | — |
| F-12 | **Privacy claims are inaccurate.** Onboarding promises an "encrypted backup" (the Drive file is plain JSON) and "Nothing leaves your phone", while Google Fonts load on every launch and Crashlytics is enabled by default without consent. PRD FR-12 asks to state that the lock does not encrypt storage. | [IntroCarousel.tsx](../../artifacts/financial-clarity/src/components/onboarding/IntroCarousel.tsx) line 50; [AuthStep.tsx](../../artifacts/financial-clarity/src/components/onboarding/AuthStep.tsx) line 60; `index.css` line 1; `crashlytics.ts` | — |
| F-13 | **No `FLAG_SECURE`.** Balances appear in the Android Recents thumbnail and screenshots; with the default 30 s timeout, returning quickly shows data without a lock. | [MainActivity.java](../../artifacts/financial-clarity/android/app/src/main/java/com/bytetobrain/fiscalfocus/MainActivity.java) | Device only |
| F-14 | **Dialogs without an accessible title.** Radix logged "`DialogContent` requires a `DialogTitle`" repeatedly (month-end flow and sheets). | Browser console | — |
| F-19 | **SMS-removal work exists only on one machine.** `chore/remove-dead-code` is not on GitHub and its 273 changes are uncommitted; `origin/main` still declares `READ_SMS`. A home-PC clone builds the old SMS app. | `git ls-remote`, `git show origin/main:…/AndroidManifest.xml` | — |
| F-15 | **Month-end review opens as a modal mid-task.** Adding a transaction dated last month immediately opened the review over the current flow (FR-09 / D8 pending). | Exploratory run | — |
| F-20 | **Google Drive sign-in on a self-built APK needs setup.** Without registering that APK's signing SHA-1 and adding the account as an OAuth test user, sign-in fails. | `capacitor.config.ts`, consent screen in testing | Documented in BUILD_ON_HOME_PC.md §5 |

### P2

| ID | Finding | Evidence |
|---|---|---|
| F-16 | **Payment method entry is disabled** with `{false && …}`, so the card-debt chip and card-bill logic are unreachable for manual entries, and the dead block breaks AGENTS.md §4. | [TransactionSheet.tsx](../../artifacts/financial-clarity/src/components/TransactionSheet.tsx) line ~418 |
| F-17 | **No amount bounds.** `99999999999999` is accepted and renders as "₹10000000.01 Cr"; `0.001` is accepted. | Exploratory run |
| F-18 | **1.2 MB main chunk** (already P4-5). | Build output |
| F-21 | **Web preview raises `Uncaught [object Object]`** from Google auth init without a web client ID; every launch contacts `fonts.googleapis.com`, `apis.google.com`, `accounts.google.com`. | Browser console/network |

### P3

| ID | Finding |
|---|---|
| F-22 | Raw colours instead of tokens (`text-red-500`, `bg-red-600` in LockScreen; `bg-[hsl(222,65%,13%)]`, `text-emerald-400` on Dashboard). |
| F-23 | Month-end review shows "Savings rate 0%" next to "Net saved ₹40,000"; Analysis shows 24 vs 25 days left in two cards. |
| F-24 | Budgets button says "Transfer to December" while FR-05 says copying is not a transfer. |
| F-25 | Build scripts call `npx cap sync` (AGENTS.md §6 says pnpm only); `pnpm exec cap` works. |
| F-26 | FileProvider exposes `external-path "."` (template default; not exported, per-URI grants only). |

### Resolved in this change

| ID | Finding | Resolution |
|---|---|---|
| R-01 | Home-PC guide required JDK 17 (Capacitor 8 needs 21) and documented the removed SMS flow. | [BUILD_ON_HOME_PC.md](../BUILD_ON_HOME_PC.md) rewritten; JDK references in [BUILD_AND_DEPLOY.md](../BUILD_AND_DEPLOY.md) corrected. Closes D-3 of the phase 3–4 review. |
| R-02 | No browser coverage for the P0/P1 defects above. | Eight `test.fail()` reproductions registered in [testing.md](../testing.md) (QA-003–QA-005). |

## What works

- Onboarding, add/edit/delete transactions with confirmation, calculator entry with Indian grouping.
- Dashboard lifetime balance, carry-forward, and monthly net match PRD §6 for the seeded data.
- Notes render as text: an `<img onerror>` payload did not execute.
- Recurring expenses: day 31 clamps to 30 Sep; three-month catch-up; no duplicates after reloads.
- Budgets: over-limit alert on Dashboard; CSV import rejects malformed amounts with a row number.
- Android: `allowBackup="false"`, no SMS permission in the working tree, `drive.file` scope, `google-services.json` gitignored, no keystores in the repo.
- Crashlytics plugin catches its own exceptions, so a build without `google-services.json` still starts.

## Suggested order

1. Commit and push the cleanup branch (F-19).
2. P0: F-03 + F-01 + F-02 (CSV), F-04 + F-09 + F-13 (lock), F-05 (backup overwrite guard).
3. P1 data rules: F-07 (category deletion), F-08 (persist-first, with P3-2 key catalogue).
4. Shared selectors for consumption/savings (F-10), then F-11.
5. Copy and disclosure fixes (F-12) under the pending D9 review; F-14 accessibility titles.
6. Decide F-16 (restore payment method or remove card features); F-15 under D8.

## Decisions needed from the owner

1. Approve implementation of any finding (AGENTS.md §1.3).
2. F-02: confirm import behaviour after preview — all-or-nothing, or import valid rows and list skipped ones.
3. F-05: on "Back up now", block, warn, or snapshot when the Drive backup has more records than the device.
4. F-09: keep the 30-second cooldown, or escalate it (for example 30 s → 5 min → 30 min) across restarts.
5. F-10: should the Transactions screen total be consumption spend or a raw list total (same question as P3-3)?
6. F-16: bring payment method back to manual entry, or remove the credit-card features.

## Gaps

- No Android build or device run; F-06, F-13, and F-20 come from configuration review.
- Drive backup, restore, and auto-backup were not exercised; F-05 comes from code review.
- Exploratory scripts are kept in the session folder, not the repository; the committed reproductions cover F-01–F-04, F-07, F-09.
- Line numbers drift as code changes.
