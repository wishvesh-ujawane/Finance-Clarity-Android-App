# Fiscal Focus Implementation Plan

**Status:** Proposed plan only. This document does not authorize application
implementation. The PRD's execution register currently authorizes the PRD
update only; obtain explicit owner approval before changing app code.

## Planning basis and constraints

This sequence follows [PRD.md](./PRD.md), [DESIGN.md](./DESIGN.md),
[ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), and
[AGENTS.md](../AGENTS.md). No `API.md` was present when this plan was prepared;
the API boundary is described in ARCHITECTURE §10.

- Fiscal Focus is an offline-first, single-user Android app. Core finance
  features use on-device storage; Google Drive is optional backup/recovery.
- There is no first-party finance API, backend, server database, or sync in the
  MVP. The repository contains no server or database code; do not add any.
- Preserve the `financial-clarity:` storage prefix, app ID, stable IDs,
  existing backup behavior, and supported old-backup compatibility.
- Do not add product features outside PRD §13. Month-end redesign, backup
  expansion, and privacy/store declarations remain pending or deferred.
- Order work so the persistence and shared domain foundations precede features
  that depend on them. Keep refactors incremental and preserve public context
  APIs where specified.

## Phase 0 — Confirm scope and implementation authorization

**Goal:** Resolve approval and requirement gates before application changes.

**Features/tasks**

- Obtain explicit authorization to implement; PRD documentation approval does
  not authorize app changes.
- Confirm unresolved category behavior: what happens to an active recurring
  rule when its category becomes inactive.
- Resolve whether deleting a generated recurring occurrence should suppress it
  permanently before implementing that edge behavior.
- Keep month-end redesign and privacy/store disclosures as separate decision
  gates; do not silently expand either.
**Likely files/modules:** No application files. Record decisions through the
repository's documented process if approved.
**Dependencies/prerequisites:** Owner decisions and implementation approval.
**Database/API changes:** None.
**Tests required:** None.

**Completion criteria:** Scope is explicitly authorized, and any unresolved

## Phase 1 — Characterize the app and remove SMS
**Goal:** Establish a testable baseline and remove the explicitly out-of-scope
SMS capability without disturbing historical finance data.

**Features/tasks**

- Inventory existing routes, SMS code, plugin wiring, permissions, tests, and
  dedicated dependencies.
- Remove SMS screens, routes, scanning and approval flows, parsers, native
  reader/plugin wiring, SMS permissions, and dependencies used only by SMS.
  unused; do not add replacement infrastructure.
**Likely files/modules:** `artifacts/financial-clarity/src/App.tsx`; related
Android manifest/plugin configuration; SMS tests and fixtures.
**Dependencies/prerequisites:** Phase 0 authorization; inspect current tests
and release manifest before removal.

**Database/API changes:** No API changes. Keep legacy SMS backup compatibility
and existing storage keys.

**Tests required:** Route and feature tests; tests for legacy-data
compatibility; inspect the merged/release Android manifest to verify SMS
permissions and active SMS implementation are absent.

**Completion criteria:** No SMS entry point or active implementation remains
in the app/release configuration, and existing financial records and supported
backups remain readable.

## Phase 2 — Establish reliable local storage and migration boundaries

**Goal:** Make a successful save mean data was durably written and provide safe
storage boundaries for later behavior changes.

**Features/tasks**

- Centralize storage keys, schemas, reads/writes, and migration execution in
- Return typed success/failure results; persist before committing finance
- Preserve state and form values on failed writes, and surface actionable
- Quarantine invalid stored data rather than dropping or overwriting it.
  writes; write the storage version last.

`artifacts/financial-clarity/src/lib/storage/`; finance persistence in
`src/lib/`.

**Dependencies/prerequisites:** Phase 1 baseline. Keep existing keys, IDs, and
stored formats except for explicitly versioned migrations.

**Database/API changes:** On-device `localStorage` only. Add the documented
storage-version key and migration framework. No server or first-party API.

**Tests required:** Storage read/write and quota-failure tests;
state-unchanged-on-failure tests; quarantine tests; migration idempotency and
rollback tests.

**Completion criteria:** Storage errors are returned and visible, failed
writes do not appear successful in app state, corrupt data is preserved for
recovery, and migrations can be safely rerun.

## Phase 3 — Centralize financial rules and shared selectors

**Goal:** Make the approved financial baseline the single source of truth
across screens.

**Features/tasks**

- Implement or consolidate pure domain calculations for income, consumption
  spending, savings contributions, monthly net, carry-forward, lifetime
  balance, commitments, and outstanding card amount.
- Centralize date/month boundaries and shared period selectors.
- Preserve the current money representation and date-only financial semantics.
- Consolidate amount/date formatting into canonical helpers.

existing shared formatter module; `src/lib/types.ts`; and

**Dependencies/prerequisites:** Phase 2 storage boundary. Do not change
financial definitions beyond PRD §6.

**Database/API changes:** None.

**Tests required:** Unit tests for each approved metric, date/month boundaries,
formatter behavior, and cross-screen consistency using one synthetic dataset.

**Completion criteria:** Each financial metric has one domain implementation,
and screens use shared selectors rather than independently re-summing
transactions.

## Phase 4 — Category status, deletion rules, and data compatibility

**Goal:** Support active/inactive categories while protecting historical
references and old data.

**Features/tasks**

- Enforce category usage checks in domain mutations for transactions, budgets,
  and recurring rules.
- Add active/inactive behavior: inactive categories remain visible in history
  and are excluded from new-entry selection, subject to confirmed requirement
  details.
- Implement the documented local migration so existing categories default to
  active.
  newer backup schemas.
- Preserve reserved-category protections and stable IDs.
management and transaction/budget/recurring pickers; local and backup

**Dependencies/prerequisites:** Phases 2–3. Resolve the pending interaction
between inactive categories and active recurring rules before implementing
that edge case.

**Database/API changes:** Add `active` to local category data; local migration
v1; advance backup schema from v3 to v4, defaulting missing `active` to true.
No API changes.

**Tests required:** Used versus unused deletion; reserved-category
protections; inactive-category history and picker behavior; migration
idempotency; restore tests for v1–v3 and refusal of newer backups.

**Completion criteria:** Used categories cannot be deleted through either UI
or domain mutation; inactive categories preserve readable history; existing
users and supported backups migrate safely.

## Phase 5 — Implement recurring expense scheduling

**Goal:** Generate due recurring expenses according to approved scheduling
behavior without duplicates or unexpected backfill.

**Features/tasks**
- Clamp scheduled days to the month's last day.
- Skip paused months and process due active occurrences after app reopen/resume.
  generated entries when a rule is edited or deleted.
- Implement occurrence-deletion behavior only after the open product decision
  is resolved.

**Likely files/modules:** Recurring scheduler in `src/lib/domain/`; finance
context actions; `src/lib/storage/` schemas and multi-key writes; recurring
screens and tests.

**Dependencies/prerequisites:** Phases 2–4; confirmed category eligibility
and occurrence-deletion decisions.

**Database/API changes:** Optional transaction provenance fields for rule ID
and occurrence month; forward-only recurring cursor behavior. No remote API.

**Tests required:** Day 31 in short months; leap and non-leap February;
paused/resumed periods; catch-up after time away; repeated-run and
interruption/idempotency cases; persistence failure behavior.

**Completion criteria:** Every eligible due occurrence is generated at most
once, paused periods are not backfilled, and failures do not falsely advance
persisted state.

## Phase 6 — Integrate transaction, dashboard, budget, and savings journeys

**Goal:** Apply shared domain and storage rules consistently to core daily-use
**Features/tasks**
- Align transaction creation/editing/search/filtering and destructive
- Use shared selectors for Dashboard metrics and budget progress.
- Keep spending and savings budgets distinct; implement limit-only budget
  copying with explicit overwrite details.
- Keep Goal Savings and Emergency Fund targets distinct from monthly savings
  budgets.
- Ensure save errors preserve form values and never show success before
  persistence.

**Likely files/modules:** Transaction, Dashboard, Budgets, and Savings pages
and components under `src/pages/` and `src/components/`; finance context
actions; domain selectors and form schemas.

**Dependencies/prerequisites:** Phases 2–5.

**Database/API changes:** No new entities expected; use existing transaction,
budget, and savings-target models.

**Tests required:** Form validation and save-failure tests; budget copy
overwrite semantics; savings-versus-consumption calculations; UI tests for
confirmations and state updates; offline save/restart verification.

**Completion criteria:** Core journeys work offline, affected totals agree
across screens, budget copying changes limits only, and destructive/overwrite
actions describe their effects.

## Phase 7 — Align Analysis and preserve month-end behavior
**Goal:** Make analysis trustworthy while keeping month-end behavior within


- Guard insufficient-history cases and avoid invalid percentages or
  confirmation.
- Preserve the current month-end flow and accounting behavior; apply only
  separately approved design/accessibility fixes.
- Do not redesign month-end until a proposal is reviewed and approved.

**Likely files/modules:** Analysis pages/components; `src/lib/domain/`
analysis selectors; month-end components/context and tests.

**Dependencies/prerequisites:** Phase 3 selectors; Phase 6 budget and
recurring behavior.

**Database/API changes:** None unless a separately approved month-end change
requires them.

**Tests required:** Analysis guards and calculations; cross-screen
consistency; existing month-end eligibility/state tests; verify no duplicate
reconciliation adjustments are introduced.

**Completion criteria:** Analysis uses canonical financial definitions,
insufficient data is handled honestly, and existing review behavior is not
unintentionally changed.

## Phase 8 — Preserve backup, restore, CSV, and sharing behavior

**Goal:** Maintain recovery and export behavior while supporting approved
migrations and surfacing failures.


  and old-backup compatibility.
  compatibility data without restoring SMS functionality.
  counts, and preserve formula escaping.
  from build metadata rather than a hard-coded value.

**Likely files/modules:** Backup and CSV modules; `BackupContext`; Google
Drive and filesystem/share platform adapters; backup screens; migration
fixtures and tests.

**Dependencies/prerequisites:** Phases 2 and 4; Phase 5 if recurring
provenance is included in backup data.

**Database/API changes:** Backup schema v4 for category status and documented
optional recurring fields. No first-party API; Drive remains optional and
user-authorized.

**Tests required:** v1–v3 restore fixtures and v4 round-trip; newer-version
refusal; multi-key rollback; CSV validation/deduplication/formula escaping;
visible share failure; representative recovery check.

**Completion criteria:** Existing backup behavior remains in scope and
functional, supported backups migrate safely, and export/restore failures are
clearly reported.

## Phase 9 — Complete shell, security, and design/accessibility alignment

**Goal:** Ensure the app shell and key screens meet documented interaction,
accessibility, and privacy requirements.

**Features/tasks**
  locked; make the lock screen topmost.
  package IDs, storage keys, and backup paths.
  reduced-motion behavior, touch targets, keyboard-safe forms, TalkBack
  labels, and required empty/error states.
- Review Crashlytics, permissions, privacy disclosures, consent, and Play
  Data safety declarations; do not claim readiness until these decisions are
  reviewed.

**Likely files/modules:** `App.tsx`, `main.tsx`, `index.css`, shell/navigation/
lock components, font assets, platform adapters, Android manifest/configuration,
and affected UI tests.

**Dependencies/prerequisites:** Core feature phases; privacy and store
disclosure decisions before release claims.

**Database/API changes:** No new API or finance storage model expected.

**Tests required:** Lock-screen content isolation; accessibility/component
checks; keyboard-open and larger-text device walkthrough; reduced-motion
verification; permission and release-manifest inspection.

**Completion criteria:** No financial UI is rendered while locked, core
screens meet documented design/accessibility requirements, and unresolved
privacy/store questions are reported.

## Phase 10 — Release verification and CI



- Add the minimal documented PR workflow: frozen-lockfile install,
- Verify offline persistence across restart, metric consistency, category
  data retention.
  expected permissions are present.
- Run the documented Android device checks at default and 130% text size,
  including TalkBack, keyboard-open forms, and airplane-mode use.

**Likely files/modules:** CI workflow; test suites; Android build
configuration; release/build documentation only where needed.

**Dependencies/prerequisites:** Implementation phases complete and unresolved
release/privacy decisions closed.

**Database/API changes:** None.

**Tests required:** `pnpm --filter @workspace/financial-clarity run test:run`,
`pnpm run typecheck`, `pnpm run build`, plus the manual device and recovery
checks in PRD §14.

**Completion criteria:** Automated checks pass, release artifact and
permissions match scope, representative recovery and device checks pass, and
no known critical data-loss or disclosure defect remains.

## Recommended first task

First obtain explicit owner authorization for implementation scope. Once
approved, add characterization tests for finance persistence failures, then
implement the persist-first, typed-result storage path for one representative
finance mutation. This small, independently verifiable foundation establishes
the durability contract needed by migrations, categories, recurring
generation, and later feature work without starting a broad refactor.

## Implementation status

The owner authorized implementing every phase on 2026-11-12 ("run the loop
and complete all the phases"). Each phase is committed on its own branch,
stacked on the previous phase because `main` does not contain the earlier
phases yet. Decisions taken during implementation are logged in
[audits/2026-11-12-phases-implementation-review.md](./audits/2026-11-12-phases-implementation-review.md).

**Update 2026-11-14:** every phase branch, the owner-decisions follow-up, the
UI polish (PR #28), and the card dues work (PR #29) are merged into `main`.
For the current state and open items, see [PROGRESS.md](./PROGRESS.md).

Note: the 2026-11-11 "Updated Docs" commit removed some lines from the phase
descriptions above (several bullets now end mid-sentence). The full wording
used for implementation is in the previous revision of this file
(`git show 34c68ef^:docs/IMPLEMENTATION_PLAN.md`).

### Phase 1 — Done (branch `chore/phase-1-sms-removal-verification`)

- Done: confirmed SMS screens, routes, parsers, native plugin, `READ_SMS`, and
  SMS-only dependencies are gone; legacy SMS keys and backup blocks stay
  readable. Added a Vitest guard for the manifest, `MainActivity`, and npm
  dependencies, and e2e NAV-002 for the removed route.
- Open: the merged release manifest has not been inspected (no Android SDK
  on the development machine). Carried to Phase 10.

### Phase 2 — Done (branch `feature/phase-2-storage-boundaries`)

- Done: one key catalogue (`lib/storage/keys.ts`) and one validator set
  (`lib/storage/schemas.ts`); quarantine with dedupe, savings goal included,
  and a dismissible notice; startup storage check with full-screen errors;
  local migration runner (`storage-version`); typed `applyBackup`. ADR 0005.
- Open: non-finance modules (security, onboarding, month-end review, Google
  profile cache, backup preferences) still call `localStorage` directly and
  ignore write errors (owner chose keys-only). Local migrations 1 and 2 were
  deferred to Phase 4 with backup v5.

### Phase 3 — Done (branch `feature/phase-3-domain-metrics`)

- Done: every PRD §6 metric in `lib/domain/finance-metrics.ts`; period helpers
  in `lib/domain/periods.ts`; formatters in `lib/format.ts` (display, full,
  chart; no paise). `FinanceContext`, Dashboard, and the shared Analysis totals
  use them. Fixed card bill payments being counted as spending in Analysis,
  budget "spent", and Dashboard "today's spend". Cross-screen consistency test.
- Open for later phases: Transactions list totals (Phase 6); Analysis-only
  figures — safe-to-spend balance, weekday heatmap, daily spend, burndown,
  known future expenses (Phase 7); switching list and card amounts to the
  compact display format (Phase 9); the month-end snapshot still counts card
  bill payments (pending D8).

### Phase 4 — Done (branch `feature/phase-4-category-status`)

- Done: categories have an `active` flag enforced in `FinanceContext`
  (new transactions, new budgets, and new or edited recurring rules need an
  active category; an edited transaction may keep its own); built-in
  categories plus Other/Other Income are always active; active names are
  unique ignoring case; pickers offer active categories only; "Mark
  inactive/active" and "Inactive" badges; local migrations 1 (`active`) and 2
  (every budget has a month; collisions quarantined); backup schema v5.
  ADR 0006. E2E CAT-003.
- Open for later phases: owner confirmation of the PRD FR-03 picker
  assumption and the inactive-category/active-recurring-rule detail (current
  behavior: the rule keeps generating); DESIGN §13 collapsible Inactive
  section (Phase 9).

### Phase 5 — Done (branch `feature/phase-5-recurring-scheduler`)

- Done: pure scheduler `planRecurringGeneration` (`lib/domain/recurring.ts`);
  single-flight `FinanceContext.processRecurring`; generation only after
  unlock and on every resume, never while locked; tests for short months,
  leap years, catch-up, repeated runs, interrupted saves, and legacy matches.
  E2E REC-003.
- Open for later phases: permanent suppression of a deleted occurrence is
  still an open PRD FR-07 decision (the forward-only cursor already prevents
  re-creation).

### Phase 6 — Done (branch `feature/phase-6-core-journeys`)

- Done: Transactions "Spending" tile and day totals use consumption; budget
  copy is "Copy to {month}" with a confirmation listing new, replaced, kept,
  and skipped budgets, and copies limits only; the delete confirmation names
  the entry; the entry sheet ignores repeated taps (fixed a double-save bug).
  Dashboard and budget progress already used shared selectors. E2E TXN-002
  and BUD-002.
- Open for later phases: DESIGN §4.6 row styling for savings and card
  payments (Phase 9); offline restart and device checks (Phase 10).

### Phase 7 — Done (branch `feature/phase-7-analysis`)

- Done: Analysis uses the PRD §6 rules for safe-to-spend, projection, known
  future spending, weekday and daily spend, the day-to-day pace chart, and the
  savings rate (`lib/domain/analysis.ts`); "Insufficient history" instead of a
  projection without an earlier month; budget suggestions confirm before
  replacing limits and report save failures. Month-end code unchanged. E2E
  ANA-001 and ANA-002.
- Open for later phases: month-end review snapshot and budget step (pending
  D8 proposal). Analysis image share failure was fixed in Phase 8.

### Phase 8 — Done (branch `feature/phase-8-backup-csv-share`)

- Done: backup `appVersion` from the build version; Analysis image sharing
  through `lib/platform/share-image.ts` with a visible failure toast; v5
  backup round-trip test. Restore preview, atomic restore, v1–v4 migration,
  v6 refusal, legacy SMS block, and CSV safety were already in place and
  were re-verified. E2E SHR-001.
- Open for later phases: backup download size guard (Proposed) and a
  blocking pre-restore safety copy are not implemented (PRD D7); a real Drive
  recovery check on a device (Phase 10, manual).

### Phase 9 — Done in part (branch `feature/phase-9-shell-design-a11y`)

- Done: "Fiscal Focus" branding; bundled fonts (no runtime Google Fonts);
  compact amount display outside month-end; 11 px minimum text; worded
  status chips; single 75% threshold; safe-area insets; reduced motion; 48 px
  hit areas on the entry sheet's icon buttons; disabled-submit hint; Red 600
  destructive token; Drive error logs without URLs or server text. Lock-screen
  isolation was already complete. E2E DSN-001.
- Open: DESIGN G2 (remaining 500-level fills), G6 (one period selector), G13
  (semantic tokens), a Content Security Policy, the collapsible Inactive
  section, savings/card-payment row styling; Crashlytics scrubbing and the
  privacy/Data safety review (pending D9); device accessibility walkthrough.

### Phase 10 — Done in part (branch `feature/phase-10-release-ci`)

- Done: minimal pull-request CI (`.github/workflows/ci.yml`: frozen-lockfile
  install, typecheck, Vitest, web build), ARCHITECTURE A11 resolved; E2E
  UPG-001 (upgrade from pre-migration storage); PRD §14 release checklist in
  `docs/testing.md` "Release verification". Final local run: typecheck pass,
  Vitest 249/249, Playwright 56 passed / 8 skipped, build pass.
- Open: every manual device step in the release checklist (offline restart,
  recurring catch-up, merged release manifest, upgrade install, 130% text,
  TalkBack, real Drive restore) and the Play privacy/Data safety review
  (pending D9). This machine has no Android SDK or device.
- Final review, decision log, and owner decisions still needed:
  [2026-11-12 phases implementation review](./audits/2026-11-12-phases-implementation-review.md).

### Owner decisions follow-up — Done (branch `fix/owner-decisions-d8`)

- Done:
  - The owner answered PRD FR-03, FR-07, D7, D8, D9, and CI pinning on 2026-11-12.
  - A category with an active recurring rule cannot be made inactive.
  - Month-end no longer counts card bill payments as spending.
  - A Card bill step records card bill payments.
  - Reconcile adds the unpaid card amount to the expected bank balance.
  - Plan ahead shows budget save failures.
  - Crashlytics is removed.
  - ADR-0007; E2E MER-001 and MER-002.
- Open:
  - Privacy policy and Play Data safety form.
  - Device check of the Card bill step.
  - Other month-end items (repeat reconciliation, adjustment duplication) remain pending D8 review.
- Done later: the DESIGN §4.6 "Card payment" row label shipped with PR #29.

### UI polish — Done (PR #28, branch `feature/ui-polish`)

- Done: semantic money and status tokens (DESIGN G2, G13), Slate 600
  secondary text, focus ring and press feedback, 48 px targets (G11), shared
  `PeriodSelector` on Dashboard and Analysis (G6), Analysis small-phone layout
  fixes, accessible entry sheet dialog, Not Found page, ESLint, and axe e2e
  checks. ADR-0009.
- Open: period selector on Transactions and Budgets (needs approval); dense
  7-column grids below 48 px (exception pending approval).

### Card dues, budget summary, and Trends — Done (PR #29, branch `feature/card-dues-budget-clarity-trends`)

- Done: "Paid with credit card" checkbox; tappable "On your card" chip with
  `CardDuesSheet` that records bill payments on their date; "Card payment"
  row label; one shared budget summary (`BudgetSummaryCard`) on Budgets and
  Analysis; Trends shows category changes and the top-5 category trend. PRD
  D11, ADR-0010.
- Open: device check at 130% font size; What's New entry with the next
  deployment.