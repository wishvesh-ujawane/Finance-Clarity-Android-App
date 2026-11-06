# Browser E2E Test Register

This document is the feature-wise inventory for future browser-based Playwright end-to-end (E2E) tests. It records proposed scenarios and how they relate to existing Vitest coverage; a Vitest suite link does **not** mean the corresponding browser flow is already covered.

**Current status:** Playwright is configured for the browser app. APP-001, NAV-001, TXN-001, and SEC-001 through SEC-003 are implemented and have passed in Chromium desktop and mobile-sized viewport runs. Chromium is installed in the current environment; a new machine may need to install it.

## Proposed Playwright setup

Keep the E2E target to the browser app. Native Android WebView/device coverage is separate and is not implied by browser tests.

Current setup:

1. `@playwright/test` is a development dependency of `@workspace/financial-clarity`.
2. Configuration is in [`playwright.config.ts`](../artifacts/financial-clarity/playwright.config.ts) and browser specs are in `artifacts/financial-clarity/e2e/`.
3. Playwright starts Vite on `127.0.0.1:4173`; each test gets an isolated browser context. Chromium runs the same cases at desktop and mobile-sized viewport dimensions. Viewport emulation is not Android WebView validation.
4. Run from the repository root with `pnpm --filter @workspace/financial-clarity run test:e2e`. Before a first run on a machine, install the browser with `pnpm --filter @workspace/financial-clarity exec playwright install chromium`.
5. Use `pnpm --filter @workspace/financial-clarity run test:e2e:list` to validate test discovery without executing cases. `pnpm --filter @workspace/financial-clarity run test:e2e:ui` opens Playwright's UI.
6. Vitest excludes the E2E naming pattern by convention: Playwright files use `*.pw.ts`, while Vitest suites use `*.test.*` or `*.spec.*`.
7. Prefer accessible roles and labels in selectors. Add stable test IDs only when a reliable user-facing locator is unavailable; preserve existing documented IDs where applicable.
8. State is deterministic per test through fresh browser contexts. APP-001 keeps onboarding storage empty; NAV-001 seeds only the onboarding-complete flag before page scripts run.
9. The app package `typecheck` script also checks the Playwright configuration and specs via `tsconfig.e2e.json`.

The existing unit/component test command is `pnpm --filter @workspace/financial-clarity run test:run` (Vitest). Keep Vitest and Playwright commands separate.

## Case status

| Status | Meaning |
|---|---|
| Planned | Candidate browser E2E scenario; not implemented or run. |
| Planned — confirm behavior | Scenario depends on confirming the expected product behavior before implementation. |
| Gap | No focused existing automated suite was identified for this feature or UI journey. |
| Implemented — passed | Browser E2E case ran successfully in the listed Chromium project(s). |
| Implemented — expected failure | Browser E2E case reproduces a known defect. It asserts the correct behaviour and is marked `test.fail()`, so the suite stays green while the defect exists. When the fix lands, Playwright reports an unexpected pass; remove `test.fail()` and change the status to *Implemented — passed*. |

Case IDs are stable references. Do not reuse an ID if a case is removed; mark it retired in the change history or replace it with a new ID.

## Feature-wise cases

| Case ID | Feature | Scenario and expected outcome | Related existing Vitest suite(s) | E2E status |
|---|---|---|---|---|
| APP-001 | App startup | Start the local app with a fresh browser context. The app reaches its first-run onboarding flow without a startup error. | No focused app-startup suite identified. | Implemented — passed on desktop and mobile-sized viewport: [`app-navigation.pw.ts`](../artifacts/financial-clarity/e2e/app-navigation.pw.ts) |
| ONB-001 | Onboarding | Complete onboarding with synthetic choices. The dashboard becomes available, and a reload does not restart completed onboarding. | No focused onboarding suite identified. | Planned — Gap |
| NAV-001 | Navigation | Visit primary pages from the app navigation and supported settings sub-pages. Each route renders its expected page and the user can navigate back to another section. | No focused navigation or page-route suite identified. | Implemented — passed on desktop and mobile-sized viewport: [`app-navigation.pw.ts`](../artifacts/financial-clarity/e2e/app-navigation.pw.ts) |
| DASH-001 | Dashboard | With deterministic synthetic transactions and budgets, dashboard totals and breakdowns match the seeded values; opening a listed transaction leads to the matching transaction. | [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [finance-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/finance-utils.test.ts) | Planned |
| TXN-001 | Transactions | Check the empty state, reject zero/negative/non-numeric amounts, create a valid synthetic expense, and verify it persists after reload. Edit and delete remain uncovered. | [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx) | Implemented — passed on desktop and mobile-sized viewport: [`app-navigation.pw.ts`](../artifacts/financial-clarity/e2e/app-navigation.pw.ts) |
| BUD-001 | Budgets | Create or update a category budget, then add a synthetic expense in that category. The budget view shows the saved budget and updated spending/progress. | [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [isConsumptionExpense.test.ts](../artifacts/financial-clarity/src/lib/__tests__/isConsumptionExpense.test.ts) | Planned |
| ANA-001 | Analysis | Select a period and inspect an expense breakdown. Its totals match the same synthetic transactions shown in the transaction list; following a breakdown to its transactions shows the matching records. | [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [reconciliation.test.tsx](../artifacts/financial-clarity/src/context/__tests__/reconciliation.test.tsx), [finance-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/finance-utils.test.ts) | Planned |
| CAT-001 | Categories | Add or edit a synthetic category. The saved category appears in the relevant category choices and remains available after reload. | No focused category UI suite identified. | Planned — Gap |
| CAT-002 | Categories | Open a category that has transactions. Delete is not offered (PRD FR-03, D6). | No focused category UI suite identified. | Implemented — expected failure (QA-005), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| CSV-001 | CSV export | Export a transaction whose note starts with `=`. No exported cell starts with `=`, `+`, `-`, or `@` (AGENTS.md §9). | No focused CSV suite identified. | Implemented — passed (QA-003 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| CSV-002 | CSV round-trip | Export income and a savings contribution, then import the same file. No category is duplicated and no transaction is added. | No focused CSV suite identified. | Implemented — passed (QA-003 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| CSV-003 | CSV import | Choose a valid CSV file. Nothing is written to storage before the user confirms a preview (AGENTS.md §9). | No focused CSV suite identified. | Implemented — passed (QA-003 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| CSV-004 | CSV import | Import a row dated `2026-13-45`. An invalid-date error is shown and nothing is imported. | No focused CSV suite identified. | Implemented — passed (QA-003 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| REC-001 | Recurring expenses | Add or edit a synthetic recurring expense. The recurring-expenses page shows the saved item and its configured amount/frequency after reload. | [isConsumptionExpense.test.ts](../artifacts/financial-clarity/src/lib/__tests__/isConsumptionExpense.test.ts) | Planned |
| GOAL-001 | Savings goals | Create a synthetic savings goal and update its progress. The saved goal and progress are displayed consistently after reload. | [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [finance-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/finance-utils.test.ts) | Planned |
| SEC-001 | Security | Configure a synthetic PIN, verify browser biometrics are unavailable, reload into the lock screen, reject an incorrect PIN, keep finance content hidden, and unlock with the correct PIN. | [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts) | Implemented — passed on desktop and mobile-sized viewport: [`app-navigation.pw.ts`](../artifacts/financial-clarity/e2e/app-navigation.pw.ts) |
| SEC-002 | Security | Simulate a storage write failure during PIN setup. Show an error instead of success, leave the lock disabled, and allow retry after storage recovers. | [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts) | Implemented — passed on desktop and mobile-sized viewport: [`security-storage.pw.ts`](../artifacts/financial-clarity/e2e/security-storage.pw.ts) |
| SEC-003 | Security | Simulate failures changing and removing a PIN. Show errors, preserve the old persisted PIN, and verify it still unlocks after reload. | [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts), [SecurityContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/SecurityContext.test.tsx) | Implemented — passed on desktop and mobile-sized viewport: [`security-storage.pw.ts`](../artifacts/financial-clarity/e2e/security-storage.pw.ts) |
| SEC-004 | Security | Lock the app with synthetic data on the Dashboard. While locked, no page content (`main`, balance) is mounted ("Locked means not rendered", AGENTS.md §9). SEC-001 does not cover this: it only checks that the Dashboard heading is absent while locked on `/settings/security`. | [SecurityContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/SecurityContext.test.tsx) | Implemented — passed (QA-004 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| SEC-005 | Security | Enter five wrong PINs, then reload. The cooldown is still active. | [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts) | Implemented — passed (QA-004 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| SEC-006 | Security | Press Tab repeatedly on the lock screen. Focus never leaves the lock screen or its dialogs. | No focused suite identified. | Implemented — passed (QA-004 fixed), desktop: [`audit-2026-11-06.pw.ts`](../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) |
| BACKUP-001 | Backup and restore | Export a backup made only from synthetic data, restore it in a fresh isolated context, and verify that the restored transaction, budget, and settings state matches the source state. | [backup.test.ts](../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts) | Planned |
| SMS-001 | SMS removal | The removed feature must not expose SMS controls, routes, or permissions. Legacy transactions and backup data remain compatible without reactivating SMS. | [sms-removal.test.tsx](../artifacts/financial-clarity/src/pages/__tests__/sms-removal.test.tsx), [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [backup.test.ts](../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts) | UI and compatibility covered by Vitest; Android release artifact verification remains outstanding |
| MEND-001 | Month-end review | With deterministic state representing a due review, verify that the review opens at the appropriate time, can be completed or dismissed, and does not block continued use of the app. | [reconciliation.test.tsx](../artifacts/financial-clarity/src/context/__tests__/reconciliation.test.tsx) | Planned — confirm trigger/reset setup |

## Cross-feature journeys

| Case ID | Journey | Expected outcome | Related existing Vitest suite(s) | E2E status |
|---|---|---|---|---|
| FLOW-001 | Transaction → dashboard → analysis | Create a synthetic expense. The transaction list, dashboard totals, and analysis breakdown agree on its amount and category, including after reload. | [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [finance-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/finance-utils.test.ts) | Planned |
| FLOW-002 | Expense → budget progress | Create a budget and an expense in the same category. The expense updates budget progress without counting non-consumption transfers as spending. | [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [isConsumptionExpense.test.ts](../artifacts/financial-clarity/src/lib/__tests__/isConsumptionExpense.test.ts) | Planned |
| FLOW-003 | SMS review → transaction → dashboard | Retired: SMS review and approval are no longer in scope. Existing SMS-origin transactions remain ordinary financial records. | [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx) | Retired |
| FLOW-004 | Backup → fresh context → restore | Restore a synthetic backup in a new browser context. The restored app shows the expected financial state without carrying over the original context's browser storage. | [backup.test.ts](../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts) | Planned |

## Existing automated suites linked above

These are unit/component tests, not browser E2E tests:

- Context and finance flows: [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [phase1-regression.test.tsx](../artifacts/financial-clarity/src/context/__tests__/phase1-regression.test.tsx), [reconciliation.test.tsx](../artifacts/financial-clarity/src/context/__tests__/reconciliation.test.tsx)
- Finance helpers: [finance-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/finance-utils.test.ts), [currency-utils.test.ts](../artifacts/financial-clarity/src/lib/__tests__/currency-utils.test.ts), [isConsumptionExpense.test.ts](../artifacts/financial-clarity/src/lib/__tests__/isConsumptionExpense.test.ts)
- Backup: [backup.test.ts](../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts)
- CSV import/export: [csv.test.ts](../artifacts/financial-clarity/src/lib/__tests__/csv.test.ts)
- Security persistence: [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts), [SecurityContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/SecurityContext.test.tsx)
- SMS removal and legacy compatibility: [sms-removal.test.tsx](../artifacts/financial-clarity/src/pages/__tests__/sms-removal.test.tsx), [FinanceContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/FinanceContext.test.tsx), [backup.test.ts](../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts)

## Planned coverage gaps

- Full onboarding completion, dashboard metric consistency, budgets, analysis, categories, recurring expenses, savings goals, backup/restore, and month-end review still lack browser-level coverage.
- Transaction edit/delete, bad-date handling, budget input boundaries/copy-overwrite, finance-storage quota failures, corruption quarantine, backup version rejection/restore, Drive offline/401/timeout failures, and the Android release permission set need focused tests or artifact checks. Security-storage failures and backup version migrations have focused unit coverage.
- Browser test state must account for local persistence and the onboarding, lock-screen, and month-end review gates. Current E2E tests use fresh contexts and narrowly seed the onboarding completion flag where required.
- Native biometrics, filesystem, and Android WebView/device behavior cannot be validated by browser viewport emulation. Stub native boundaries for browser tests; track device validation separately.
- The existing ignored Android web assets do not match the current production web build. Before producing an Android artifact, rebuild the web app and synchronize Capacitor assets (for example, `pnpm --filter @workspace/financial-clarity exec cap sync android`); then verify the merged manifest and resulting release artifact. Do not treat an artifact built from stale assets as validation of these fixes.
- Existing context/helper tests verify important calculations and state transitions, but do not prove that controls, routes, dialogs, and persisted UI behave correctly when used together.
- The requested `API.md` was not present in the repository. The architecture and PRD state that the product has no finance API or server database, so API/database failure tests are not applicable; local browser storage failures still require coverage.

## QA findings

| ID | Severity | Finding | Evidence / recommended follow-up |
|---|---|---|---|
| QA-001 | P1 / High — fixed | Enabling or changing the app PIN could report success when the security settings were not persisted. | Security writes and removals now report failures before state changes; PIN and biometric UI surfaces the error. SEC-002/003 and unit/context tests cover write/remove failures, retry, and preservation of prior settings. |
| QA-002 | P1 / High — source fixed; release artifact verification outstanding | SMS functionality and `READ_SMS` permission remained in source despite the current PRD requiring their removal before release. | Active SMS UI, routes, reader/parser, native registration and manifest permission were removed. Unit tests cover legacy data and older backup compatibility. Verify the merged manifest and permissions in a newly built Android release artifact; no Android build or device test was run here. |
| QA-003 | P0 — fixed | CSV export/import: formula cells are not neutralised; import applies without a preview; impossible dates pass; re-importing an export duplicates savings/commitment categories and counts savings as spending. | [2026-11-06 browser audit](./audits/2026-11-06-e2e-browser-audit.md) F-01–F-03. Reproduced by CSV-001–CSV-004. Fixed: export formula guard, import preview with skip-invalid rows, real-date check, savings/commitment category matching; covered by CSV-001–CSV-004 and [csv.test.ts](../artifacts/financial-clarity/src/lib/__tests__/csv.test.ts). |
| QA-004 | P0 — fixed; device check outstanding | App lock: page content stays mounted (DOM and accessibility tree) while locked; focus can leave the lock screen; failed-PIN cooldown resets on reload; no Recents protection. | Audit F-04, F-09, F-13. Fixed: only the lock screen renders while locked, focus trap, persisted escalating cooldown, `FLAG_SECURE` while the lock is on. Covered by SEC-004–SEC-006, [security.test.ts](../artifacts/financial-clarity/src/lib/__tests__/security.test.ts), and [SecurityContext.test.tsx](../artifacts/financial-clarity/src/context/__tests__/SecurityContext.test.tsx). `FLAG_SECURE` and restart-cooldown need the manual device steps in [BUILD_ON_HOME_PC.md](./BUILD_ON_HOME_PC.md) §9. |
| QA-005 | P1 — open | A category with transactions can be deleted; its transactions then show "Unknown" (PRD FR-03, D6). | Audit F-07. Reproduced by CAT-002. |

## Non-production safety

- Run only against the local Vite development server (`127.0.0.1` / `localhost`); do not point Playwright at production or a real user's environment.
- Use synthetic names, dates, amounts, transactions, messages, credentials, and backup files only. Never import or export real financial data or SMS content.
- Give each test an isolated browser context and deterministic local state. Clear or recreate the context between tests; do not reuse a personal browser profile.
- Mock native/device and external-service boundaries. Do not request real SMS, biometric, filesystem, banking, or cloud credentials/permissions.
- Keep screenshots, traces, and logs limited to synthetic data; inspect artifacts before sharing or retaining them.

## Register maintenance

- Update this register whenever E2E or related Vitest cases are added, removed, renamed, or materially changed. Keep case IDs stable and update suite links and gap/status descriptions.
- When a planned case is implemented, link its Playwright spec and record its current status; do not describe it as covered until the relevant browser test has actually run.
- Whenever testing is performed, append a dated run-log entry below with the command and outcome. Record failures and skips as well as passes; do not overwrite earlier entries.
- Keep test output and run notes free of real personal or financial data.

## Run log

Append an entry for each future test run:

| Date (YYYY-MM-DD) | Commit/branch | Command and target | Browser/viewport | Result (pass/fail/skip) | Notes or issue links |
|---|---|---|---|---|---|
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 207/207 | 17 test files passed. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Fail — 2 passed, 2 failed | Initial run hit a Vite overlay after optimizer scanning stale build output and external Google auth scripts; constrained optimizer entries and blocked Google-auth hosts in tests. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Pass — 6/6 | APP-001, NAV-001, TXN-001 passed after test environment correction. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Fail — 6 passed, 2 failed | Initial SEC-001 asserted Dashboard after unlocking a page reloaded at `/settings/security`; corrected the expected route to Security. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e -- --grep SEC-001 --workers=1` | Chromium desktop + mobile-sized | Pass — 2/2 | Correct PIN unlocks the original route; incorrect PIN leaves financial content hidden. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity exec vitest run src/lib/__tests__/security.test.ts` | Vitest/jsdom | Pass — 4/4 | Added format, salted hash/verify, valid persistence, and invalid stored-settings cases. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e -- --workers=2` | Chromium desktop + mobile-sized | Pass — 8/8 | Final APP-001, NAV-001, TXN-001, SEC-001 run after adding empty, invalid-input, persistence, lock, and browser-biometric assertions. |
| 2026-11-06 | Working tree | `pnpm run typecheck` | Full workspace | Pass | App, API server, mockup sandbox, libraries, scripts, Playwright config/specs. |
| 2026-11-06 | Working tree | `pnpm run build` | Full workspace | Pass | Build completed; existing sourcemap/dynamic import and large-chunk warnings remain. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 211/211 | Final unit/component run: 18 test files passed, including new security unit coverage. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity exec vitest run src/lib/__tests__/security.test.ts src/context/__tests__/SecurityContext.test.tsx` | Vitest/jsdom | Pass — 7/7 | Security storage failure handling, including biometric settings. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 75/75 | 10 current test files; removed obsolete SMS feature suites and added legacy compatibility and removal regression cases. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:e2e -- --workers=2` | Chromium desktop + mobile-sized | Pass — 12/12 | Includes SEC-002 and SEC-003 storage failure and retry flows. |
| 2026-11-06 | Working tree | `pnpm run typecheck` | Full workspace | Pass | Includes app and Playwright types. |
| 2026-11-06 | Working tree | `pnpm run build` | Full workspace | Pass | Existing sourcemap, dynamic-import, and large-chunk warnings remain. Android release artifact not built. |
| 2026-11-06 | Working tree | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 75/75 | Repeated after SMS-scope formatting cleanup. |
| 2026-11-06 | Working tree | `.\gradlew.bat :app:processReleaseMainManifest --no-daemon` from `artifacts/financial-clarity/android` | Android | Fail — infrastructure | Gradle wrapper download failed with a TLS connection reset; Android SDK is not configured. Merged-manifest and release-artifact verification remain outstanding. |
| 2026-11-06 | Working tree (`chore/remove-dead-code`) | `pnpm run typecheck`; `pnpm --filter @workspace/financial-clarity run test:run`; `pnpm run build` | Full workspace / Vitest | Pass — 75/75 unit | Browser audit baseline. Main JS chunk 1,207.57 kB. |
| 2026-11-06 | Working tree (`chore/remove-dead-code`) | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Pass — 12/12 | Baseline before adding audit reproductions. |
| 2026-11-06 | Working tree (`chore/remove-dead-code`) | Exploratory Playwright scripts against `vite` on 127.0.0.1 (not committed) | Chromium mobile-sized + desktop | Findings | Synthetic data only. See [2026-11-06 browser audit](./audits/2026-11-06-e2e-browser-audit.md). |
| 2026-11-06 | Working tree (`chore/remove-dead-code`) | `audit-2026-11-06.pw.ts` with `test.fail()` removed (temporary copy), desktop | Chromium desktop | Fail — 8/8 as intended | Confirmed each reproduction fails on the defect itself, not on a selector or timing problem. |
| 2026-11-06 | Working tree (`chore/remove-dead-code`) | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Pass — 20 passed (12 passed + 8 expected failures), 8 skipped | Audit reproductions run on desktop only and are skipped on the mobile-sized project. |
| 2026-11-06 | `main` working tree (fix A) | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 85/85 | 11 files; adds csv.test.ts (10 tests). |
| 2026-11-06 | `main` working tree (fix A) | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Pass — 20 passed (16 passed + 4 expected failures), 8 skipped | CSV-001–CSV-004 now pass without `test.fail()`; SEC-004–006 and CAT-002 still expected failures. |
| 2026-11-06 | `main` working tree (fix A) | `pnpm run typecheck`; `pnpm run build` | Full workspace | Pass | Existing sourcemap and large-chunk warnings remain. |
| 2026-11-06 | `main` working tree (fix B) | `pnpm --filter @workspace/financial-clarity run test:run` | Vitest/jsdom | Pass — 92/92 | Adds lockout unit tests and a SecurityContext remount test. |
| 2026-11-06 | `main` working tree (fix B) | `pnpm --filter @workspace/financial-clarity run test:e2e` | Chromium desktop + mobile-sized | Pass — 20 passed (19 passed + 1 expected failure), 8 skipped | SEC-004–SEC-006 pass without `test.fail()`; CAT-002 still an expected failure. |
| 2026-11-06 | `main` working tree (fix B) | `pnpm run typecheck`; `pnpm run build` | Full workspace | Pass | Java plugin not compiled (no Android SDK on this machine); verify with the home-PC build. |
