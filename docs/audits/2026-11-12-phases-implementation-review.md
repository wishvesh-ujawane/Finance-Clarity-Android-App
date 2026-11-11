# Implementation review — Phases 1 to 10

**Date:** 2026-11-12
**Scope:** Implementation of [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) Phases 1–10, run as one loop at the owner's request.
**Status:** Complete for code that can be verified on this machine. Device, release-artifact, and owner-decision items remain open (see "Final summary").

This report records what each phase completed, what is still open and why,
and every decision taken along the way. The per-phase summary also lives in
the "Implementation status" section of the implementation plan.

---

## Decision log

Decisions marked **Owner** were answered by the owner in the conversation.
Decisions marked **Agent** were taken by the coding agent under the owner's
instruction to run every phase; each one follows the documents where they
give an answer and picks the most conservative option where they do not.
Anything the PRD labels Pending, Deferred, or Future was not implemented.

| # | Phase | Decision | By | Reason |
|---|---|---|---|---|
| 1 | All | Each phase is committed on its own branch, created from the previous phase's branch. Nothing is pushed. | Agent | `main` does not contain the earlier phases yet, so branching from `main` would lose them. The owner approved commits but not pushes. |
| 2 | 1 | SMS removal was already done in code (commit `0894de1`); Phase 1 added regression guards and docs only. | Agent | Avoid re-doing finished work. |
| 3 | 2 | Local migration 2 (`budgets.month`) ships with Phase 4 and backup v5, not Phase 2. | Owner | Pairs the local and backup schema changes. |
| 4 | 2 | Non-finance modules get centralized key names only; their read/write behavior is unchanged. | Owner | Keep Phase 2 small. |
| 5 | 2 | A quarantined key is not rewritten at launch; identical quarantine copies are not saved twice. | Agent | Never change stored data without a user action; stops repeated copies filling storage. |
| 6 | 2 | When a quarantine copy cannot be saved, startup offers **Continue without it** behind a destructive confirmation. | Agent | DESIGN §8.2 allows overwriting only with explicit confirmation; without it a full store would lock the user out. |
| 7 | 2 | A legacy single-bucket savings goal is converted into the two-bucket shape when a backup is built (it used to be left out). | Agent | Same conversion the app already applies when loading; avoids losing it from backups. |
| 8 | 3 | Phase 3 replaces only page sums that duplicate a PRD §6 metric; Analysis-only figures wait for Phase 7 and Transactions totals for Phase 6. | Owner | Matches the phase split in the plan. |
| 9 | 3 | One formatter module with three variants; screens keep their current look until Phase 9; display never shows paise. | Owner | Visual change belongs to design alignment. |
| 10 | 3 | The Transactions page total will show consumption spending, labeled "Spending" (applied in Phase 6). | Owner | PRD §6 definition. |
| 11 | 3 | `formatINR`, `formatShortINR`, and `formatMonthYear` stay as deprecated aliases instead of renaming about 100 call sites. | Agent | Avoid a large rename-only diff; Phase 9 touches each call site anyway. |
| 12 | 3 | Budget "spent" is savings contributions for a savings category and consumption for any other category, so card bill payments no longer count. | Agent | PRD §6 consumption definition; savings budgets track contributions. |
| 13 | 3 | The month-end review snapshot is not changed even though it still counts card bill payments. | Agent | Month-end behavior is pending owner review (PRD D8, FR-09). |
| 14 | 4 | `Category.active` stays optional in TypeScript; absent means active. Migration 1, backup v5, and new categories store `true`. | Agent | Keeps pre-migration data readable everywhere; the migration guarantees stored values. |
| 15 | 4 | New transactions, new budgets, and new or edited recurring rules are refused in an inactive category; an edited transaction may keep its current inactive category. | Agent | DATABASE §6.2 and the PRD FR-03 assumption. The assumption is marked "requiring confirmation" in the PRD — **owner should confirm**. |
| 16 | 4 | An active recurring rule whose category becomes inactive keeps generating; it is not paused or deleted. | Agent | PRD FR-03 leaves this pending and forbids silently pausing or deleting the rule; no behavior change is the safe default. **Owner decision still needed.** |
| 17 | 4 | Reserved categories plus `other` and `other-income` can never be inactive; a stored inactive value is corrected at load. | Agent | DATABASE §6.2 (owner-approved in the database design review). |
| 18 | 4 | CSV import may still match an existing inactive category by name. | Agent | Import restores history rather than creating a new entry by choice. |
| 19 | 4 | Backup v4 → v5 leaves out a month-less budget that collides with an existing one instead of quarantining it. | Agent | Quarantine is local-only; the Drive file is unchanged and still holds the row. |
| 20 | 4 | Inactive categories are listed last within their type group with an "Inactive" badge instead of DESIGN §13's collapsible Inactive section. | Agent | Smaller change; the collapsible section is noted for Phase 9 design alignment. |
| 21 | 4 | The month-end budget planner hides inactive categories unless they already have a next-month budget. | Agent | Its `addBudget` result is ignored (existing month-end behavior), so offering an inactive category would fail silently. |
| 22 | 4 | Active category names are unique ignoring case; adding, renaming, or reactivating into a clash is refused. Inactive categories may share a name. | Agent | DATABASE §6.2 (owner-approved). |
| 23 | 5 | Recurring generation runs only while unlocked: once after unlock and on every return to the foreground (`visibilitychange`), plus after rule changes. It no longer runs when the data first loads. | Agent | ARCHITECTURE §6.4 and DATABASE §8.2 (no finance writes while locked). Uses the browser `visibilitychange` event so no Capacitor call is added to the context layer. |
| 24 | 5 | Deleting a generated occurrence still relies on the forward-only cursor; no permanent suppression list is added. | Agent | PRD FR-07 leaves permanent suppression pending; DATABASE §6.3 says the cursor is enough today. **Owner decision still needed.** |
| 25 | 6 | The Transactions page tile is labeled "Spending" and shows consumption; day headers use the same rule. Savings contributions and card bill payments stay visible in the list. | Owner (decision 10) | PRD §6. |
| 26 | 6 | "Transfer to {month}" is renamed "Copy to {month}", and the confirmation lists each new budget, each replaced limit (old → new), untouched target budgets, and skipped inactive categories. | Agent | PRD FR-05: copying is not a money transfer and overwrite consequences must be confirmed. |
| 27 | 6 | Budget copy skips a source budget whose category is inactive unless the target month already has that budget (then its limit is updated). | Agent | Consistent with decision 15: no new budgets in inactive categories. |
| 28 | 6 | Added a busy guard to the transaction sheet's submit button; the budget sheet needs none because adding a budget replaces the same category/month. | Agent | DESIGN §7.3. A double tap previously saved two transactions (bug 20261112-transaction-double-submit). |
| 29 | 6 | Amended the local, unpushed Phase 6 commit to restore LF line endings in one doc, and moved the then-empty Phase 7 branch to the amended commit. | Agent | Keep diffs reviewable; no published history was rewritten. |
| 30 | 7 | "Daily Safe to Spend" uses the spendable balance: income − consumption − savings contributions through today. Before, it subtracted every expense, so card bill payments were counted twice. | Agent | PRD §6 consumption rule; keeps the existing intent that money set aside for savings is not spendable. |
| 31 | 7 | Known future spending in the projection counts consumption and savings dated after today, not card bill payments. | Agent | Same rule as decision 30. |
| 32 | 7 | The projection is shown only when there is at least one earlier month of entries; otherwise "Insufficient history". | Agent | PRD FR-08 and AGENTS §8: no misleading forecasts. One prior month is the smallest basis for "average income". |
| 33 | 7 | The Trends "Monthly savings rate" uses savings contributions ÷ income, the same as Overview. It used (income − spending) ÷ income. | Agent | One definition per metric (AGENTS §5). This changes the chart's values. |
| 34 | 7 | The day-to-day pace chart uses the day-to-day budget only (savings budgets were included) and leaves out recurring entries by their stored rule ID instead of amount matching. | Agent | PRD §6 buckets; ADR 0004 replaced fuzzy matching with occurrence identity. Pre-v4 recurring entries without an ID now count as day-to-day spend. |
| 35 | 7 | Budget suggestions skip inactive categories, ask before replacing existing limits, and report the first save failure with how many were saved. | Agent | PRD FR-08 ("confirm before suggestions overwrite existing budget limits"), decision 15, AGENTS §8. |
| 36 | 7 | Month-end review code was not changed. | Agent | PRD FR-09 / D8 pending. |
| 37 | 8 | Backup `appVersion` uses the build version (`__APP_VERSION__`), falling back to `unknown`. | Agent | ARCHITECTURE A7 / API G14. Old backups keep `1.0.0`; nothing reads this field for decisions. |
| 38 | 8 | Analysis image sharing moved into a platform adapter (`lib/platform/share-image.ts`); a failure shows a toast, while closing the share sheet (an error message containing "cancel") shows nothing. | Agent | DESIGN G16, API §4.2 and §6.6, AGENTS §3.2 (pages must not import Capacitor). |
| 39 | 8 | Kept the pre-restore safety copy as best effort; a failure to save it still does not block a restore. | Agent | API §6.4 documents this; PRD D7 defers backup changes. |
| 40 | 8 | The backup download size guard (API §6.3, "Proposed, MVP-cleanup") was not added. | Agent | It is marked Proposed and D7 defers backup expansion. |
| 41 | 9 | Bundled Inter (400–600) and Manrope (500–800) as latin + latin-ext variable WOFF2 files from Google Fonts, with their OFL licences, in `src/assets/fonts` (so Vite hashes them and the relative base works). No package was added. | Agent | DESIGN G7 / ARCHITECTURE §2.1 require bundled fonts. latin-ext is needed for the rupee sign. |
| 42 | 9 | Lists, cards, tiles, the sidebar, Settings, and Analysis use the compact display format; the Savings target edit screen keeps full precision; month-end cards are unchanged. | Owner (decision 9) + Agent | DESIGN §4.6; month-end is pending D8. Amounts below ₹1 lakh look the same as before. |
| 43 | 9 | Raised every 9–10 px text and chart label to 11 px app-wide, including month-end cards, and sidebar text on navy to 60% white. | Agent | DESIGN G3 minimum is an accessibility fix, not a month-end flow or accounting change. |
| 44 | 9 | Dashboard budget chips: icon + words ("over by ₹X", "N% used", "funded", "paid"); same colors. | Agent | DESIGN §5.10. |
| 45 | 9 | Savings bars and the Analysis "Watch" pill warn at 75% (were 70% and 80%). | Agent | DESIGN §5.9 single threshold. |
| 46 | 9 | Safe areas via `viewport-fit=cover` and `env(safe-area-inset-*)` on the bottom nav, FAB, and main content; reduced motion via `MotionConfig` and a global CSS rule. | Agent | DESIGN G9, G10. Safe areas still need a device check. |
| 47 | 9 | The `destructive` token became Red 600, and the entry sheet's fills became 600-level. Other raw palette colors (DESIGN G13) were not converted to tokens. | Agent | G2 "must"; G13 is a broad refactor across many components and is left open. |
| 48 | 9 | Drive errors no longer log the URL or raw body, and Drive's message text is never shown; a generic "Drive request failed (status)" is used. | Agent | ARCHITECTURE §14.4, API §6.2.5 (A15 / G5). |
| 49 | 9 | Crashlytics scrubbing, permissions/privacy disclosures, consent, and Play Data safety were reviewed but not changed. | Agent | PRD D9 is pending owner review; the plan says not to claim readiness. |
| 50 | 9 | Not done: one combined period selector (G6), semantic tokens everywhere (G13), a Content Security Policy, the collapsible Inactive section on Categories, DESIGN §4.6 row styling for savings and card payments. | Agent | Each is a larger design change best reviewed separately; listed for follow-up. |
| 51 | 10 | CI runs on `pull_request` only: frozen-lockfile install → typecheck → Vitest → web build. | Agent | ARCHITECTURE §16.2 defines exactly this minimal workflow. |
| 52 | 10 | CI does not run Playwright or build the APK. | Agent | §16.2 excludes device farms and deployment; Playwright needs browser downloads on every run. E2E stays a local pre-release step (BUILD_AND_DEPLOY "Continuous Integration"). |
| 53 | 10 | GitHub Actions are pinned to major tags (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`), Node 24, pnpm from `packageManager`; the workflow uses no secrets and read-only `contents` permission. | Agent | Official actions; Node 24 matches BUILD_AND_DEPLOY. SHA pinning is stricter and can be adopted if the owner prefers. |
| 54 | 10 | Added UPG-001 (browser test seeding pre-migration storage) as the automated stand-in for "install over the previous release". | Agent | A real upgrade install needs a device; this proves the migrations keep and show existing records and are idempotent. |
| 55 | 10 | PRD §14 release checks are recorded in testing.md "Release verification" with automated evidence and the manual step still needed; no check is reported as passed unless it ran. | Agent | AGENTS §11; the plan says not to claim release readiness. |

---

## Phase results

### Phase 1 — Characterize the app and remove SMS

- **Completed:** SMS code, routes, plugin, permission, and dependencies confirmed absent; static guard test and e2e NAV-002 added; docs updated.
- **Pending:** merged release manifest inspection. **Reason:** no Android SDK on this machine.

### Phase 2 — Reliable local storage and migration boundaries

- **Completed:** key catalogue, shared validators, quarantine with dedupe and notice, startup storage check, migration runner, typed restore result. ADR 0005.
- **Pending:** non-finance modules still write `localStorage` directly and ignore write errors. **Reason:** owner chose keys-only for this phase.

### Phase 3 — Centralize financial rules and shared selectors

- **Completed:** one implementation per PRD §6 metric, shared period helpers and formatters, card bill payments no longer double counted, cross-screen consistency test.
- **Pending:** Transactions totals (Phase 6), Analysis-only figures (Phase 7), compact amount display (Phase 9), month-end snapshot (pending D8).

### Phase 4 — Category status, deletion rules, and data compatibility

- **Completed:** `active` flag with domain enforcement (new entries, budgets, recurring rules), built-in categories always active, pickers show active categories only (plus the edited entry's own), "Mark inactive/active" on the Categories screen, "Inactive" badges, local migrations 1 and 2 (with quarantine on budget collisions), backup schema v5 with v4 → v5 migration. ADR 0006. Unit, context, migration, backup, and e2e CAT-003 tests.
- **Pending:** owner confirmation of the PRD FR-03 picker assumption and of the inactive-category/active-recurring-rule detail (decisions 15–16). **Reason:** the PRD marks both as requiring confirmation; the safest documented behavior is implemented. Collapsible Inactive section (DESIGN §13) left for Phase 9. Unique active category names (DATABASE §6.2) were implemented in this phase.

### Phase 5 — Recurring expense scheduling

- **Completed:** the scheduler is a pure, tested planner (`lib/domain/recurring.ts`); `processRecurring` is single-flight and saves occurrences and cursors together; generation runs only after unlock and on resume; tests cover day 31 in short months, leap and non-leap February, catch-up after time away, repeated runs, interrupted saves, legacy matches, and paused/resumed rules. E2E REC-003. Clamping, paused-month skipping, and occurrence identity were already in place (ADR 0004).
- **Pending:** permanent suppression of a deleted occurrence (decision 24). **Reason:** PRD FR-07 marks it as an open product decision.

### Phase 6 — Transaction, dashboard, budget, and savings journeys

- **Completed:** Transactions "Spending" tile and day totals use consumption; budget copy explains every overwrite and copies limits only (`lib/domain/budgets.ts`); transaction delete confirmation names the entry; double-submit guard (fixed a real double-save bug). Dashboard metrics and budget progress already used shared selectors after Phases 3–4; savings targets remain separate from monthly savings budgets (no change needed); save errors keep form values (Phase 2 / A2). E2E TXN-002 and BUD-002.
- **Pending:** offline save-and-restart and device checks (Phase 10, manual). Visual treatment of savings and card-payment rows (DESIGN §4.6 colors and labels) is left for Phase 9.

### Phase 7 — Analysis and month-end preservation

- **Completed:** Overview, Planning, and Trends use the shared PRD §6 rules (`lib/domain/analysis.ts`): spendable balance, future outflow, weekday and daily consumption, day-to-day pace, one savings-rate definition. Projection shows "Insufficient history" without an earlier month. Budget suggestions confirm before replacing limits and report failures. Existing zero-base guards (week-over-week, month-over-month) kept. E2E ANA-001 and ANA-002.
- **Pending:** month-end review still counts card bill payments in its snapshot and ignores its budget save results. **Reason:** month-end is pending owner review (D8); the plan forbids changing it until a proposal is approved.

### Phase 8 — Backup, restore, CSV, and sharing

- **Completed:** backup `appVersion` from the build; image share failures shown (platform adapter); v5 round-trip test (build → serialize → validate → restore). Already in place and re-verified: Drive coverage, restore preview and confirmation, atomic restore with rollback (Phase 2), v1–v4 migration and newer-version refusal (v6), legacy SMS block, CSV validation, duplicate detection, formula escaping, and import preview. E2E SHR-001.
- **Pending:** backup download size guard and making the pre-restore safety copy blocking (decisions 39–40). **Reason:** marked Proposed / best effort in API.md and D7 defers backup changes. A representative Drive recovery check needs a real Google account and device (Phase 10, manual).

### Phase 9 — Shell, security, design, and accessibility

- **Completed:** "Fiscal Focus" branding (G1); bundled fonts, no Google Fonts requests (G7); compact amount display outside month-end (G8); 11 px minimum text and 60% white on navy (G3); worded status chips (G4); single 75% threshold (G5); safe areas (G9); reduced motion (G10); 48 px hit areas on the entry sheet's icon buttons (G11); disabled-submit hint (G15); Red 600 destructive token and 600-level entry fills (G2, partly); Drive logs without URL or server text (A15). Lock-screen isolation was already done (A8). E2E DSN-001.
- **Pending:** G2 (other 500-level fills), G6 (one period selector), G13 (semantic tokens instead of raw colors), Content Security Policy, collapsible Inactive section, DESIGN §4.6 row styling, Crashlytics scrubbing (A9) and Play Store privacy/Data safety review. **Reason:** G6/G13/CSP and row styling are broad visual changes that need their own review and a device check; A9 and the store review depend on the pending D9 decision. Device checks (TalkBack, 130% text, keyboard-open forms, safe areas) need a phone.

### Phase 10 — Release verification and minimal CI

- **Completed:** `.github/workflows/ci.yml` (pull requests: frozen-lockfile install, typecheck, Vitest, web build), ARCHITECTURE A11 resolved; UPG-001 upgrade test (pre-migration storage → version 2, all records kept and shown, second launch changes nothing); PRD §14 release checklist in [testing.md](../testing.md) "Release verification" mapping each check to its automated evidence and the manual step still needed; BUILD_AND_DEPLOY "Continuous Integration" section.
- **Final local checks (2026-11-12):** `pnpm run typecheck` pass; Vitest 249/249 (33 files); Playwright 56 passed, 8 skipped (desktop-only audit cases on the mobile project); `pnpm run build` pass (main chunk 1,236.62 kB). The CI workflow has not run on GitHub yet because nothing was pushed.
- **Pending:** every manual PRD §14 step (offline restart, closed-app recurring catch-up, merged release manifest, upgrade install over the previous release, 130% text and keyboard, TalkBack, real Drive back up → reinstall → restore) and the Play Store privacy/Data safety review. **Reason:** this machine has no Android SDK, device, or test Google account, and D9 is pending.

---

## Final summary

### Branches and commits

Each branch is built on the one before it. Merge in this order; nothing has been pushed.

| Phase | Branch | Commit |
|---|---|---|
| 1 | `chore/phase-1-sms-removal-verification` | `60fe3a5` (owner) |
| 2 | `feature/phase-2-storage-boundaries` | `6b672ed` (owner) |
| 3 | `feature/phase-3-domain-metrics` | `5febf89` |
| 4 | `feature/phase-4-category-status` | `1861e01` |
| 5 | `feature/phase-5-recurring-scheduler` | `9c73aac` |
| 6 | `feature/phase-6-core-journeys` | `3b56ac8` |
| 7 | `feature/phase-7-analysis` | `5aa15a6` |
| 8 | `feature/phase-8-backup-csv-share` | `f0152fb` |
| 9 | `feature/phase-9-shell-design-a11y` | `6340002` |
| 10 | `feature/phase-10-release-ci` | see `git log` on the branch |

### Completed vs pending

| Phase | Status | Still open | Why it is open |
|---|---|---|---|
| 1 SMS removal | Done | Merged release manifest check | No Android SDK here |
| 2 Storage | Done | Non-finance modules write `localStorage` directly | Owner chose keys-only (decision 4) |
| 3 Metrics | Done | Month-end snapshot counts card bill payments | D8 pending |
| 4 Categories | Done | Confirm picker rule and inactive-category recurring rule | PRD FR-03 says "requires confirmation" (decisions 15–16) |
| 5 Recurring | Done | Permanent suppression of a deleted occurrence | PRD FR-07 pending (decision 24) |
| 6 Journeys | Done | Offline restart on a device | Manual check |
| 7 Analysis | Done | Month-end fixes (snapshot, ignored budget save results) | D8 pending (decision 36) |
| 8 Backup/CSV/share | Done | Download size guard, blocking pre-restore copy, real Drive recovery | API marks them Proposed; D7 defers; needs a device and account |
| 9 Design/a11y | Done in part | G2 remainder, G6, G13, CSP, collapsible Inactive section, §4.6 row styling, A9 Crashlytics scrubbing | Broad visual changes need their own review; A9 depends on D9 |
| 10 Release/CI | Done in part | All manual PRD §14 device steps; Play privacy/Data safety | Needs a device, release build, Google account, and D9 |

Other documented gaps not covered by the plan's phases and left untouched: ARCHITECTURE A10 (split `FinanceContext`), A13, A14, A16 (main bundle about 1.24 MB; code splitting).

### Owner decisions needed

1. **PRD FR-03:** confirm that pickers hide inactive categories except on an edited entry's own category, and what happens to an active recurring rule whose category becomes inactive (today: it keeps generating).
2. **PRD FR-07:** should deleting a generated occurrence suppress it permanently?
3. **PRD D8 / FR-09:** approve month-end changes (stop counting card bill payments in the snapshot, report budget save failures, move to the compact formatter).
4. **PRD D9:** Crashlytics scrubbing and consent, privacy disclosures, and the Play Data safety answers.
5. **PRD D7:** backup download size guard and whether the pre-restore safety copy must block a restore.
6. **CI:** keep actions pinned by major tag or switch to commit SHAs (decision 53).

### Manual checks for the owner

Follow testing.md "Release verification" items 1, 4–8, and 10 on a phone with a release build: airplane-mode add and restart, recurring catch-up after the app stays closed across a due date, `gradlew :app:processReleaseMainManifest` shows no `READ_SMS`, install over the previous release, 130% font size and keyboard-open forms, a TalkBack pass, safe areas on a notched or gesture-nav phone, and Drive back up → reinstall → restore.