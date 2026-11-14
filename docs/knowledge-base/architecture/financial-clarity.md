---
id: architecture-financial-clarity
title: Financial Clarity app
date: 2026-06-28
updated: 2026-11-14
status: current
scope: [financial-clarity]
related:
  - ./workspace.md
  - ../features/dashboard.md
  - ../features/budgets.md
  - ../features/analysis.md
  - ../features/month-end-review.md
  - ../features/fab.md
  - ../decisions/0005-storage-startup-and-migrations.md
  - ../decisions/0010-card-dues-budget-summary-trends.md
source-of-truth-files:
  - artifacts/financial-clarity/package.json
  - artifacts/financial-clarity/vite.config.ts
  - artifacts/financial-clarity/capacitor.config.ts
  - artifacts/financial-clarity/src/App.tsx
  - artifacts/financial-clarity/src/main.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/context/FabContext.tsx
  - artifacts/financial-clarity/src/context/SecurityContext.tsx
  - artifacts/financial-clarity/src/context/BackupContext.tsx
  - artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/lib/storage/finance-storage.ts
  - artifacts/financial-clarity/src/lib/format.ts
---

# Financial Clarity app

## Purpose
Personal money-manager app, shown to users as "Fiscal Focus": dashboard,
transactions, budgets, recurring expenses, savings, analysis, month-end
review, and backup/restore. Packaged as a Vite web app and a
Capacitor-wrapped Android app. Local-only persistence (localStorage); no
server, no first-party API.

## Tech
- React 19, Vite, TypeScript ~5.9
- Tailwind CSS with semantic tokens in `src/index.css`; Manrope + Inter bundled in `src/assets/fonts`
- Recharts (charts)
- Framer Motion (sheets, swipes, FAB)
- Lucide React (icons)
- Capacitor (Android wrapper) — see [android/](../../../artifacts/financial-clarity/android/)
- Vitest + React Testing Library; Playwright with axe for e2e; ESLint

## Entry points
- [src/main.tsx](../../../artifacts/financial-clarity/src/main.tsx) — React root.
- [src/App.tsx](../../../artifacts/financial-clarity/src/App.tsx) — startup
  storage check, context providers, lock screen, layout, and routes.
- [capacitor.config.ts](../../../artifacts/financial-clarity/capacitor.config.ts)
  — Android wrapper config.

## Layers
Dependencies point downward only (AGENTS §3.2, ARCHITECTURE §4.1).

| Layer | Location | Contents |
|---|---|---|
| Domain (pure) | [lib/domain/](../../../artifacts/financial-clarity/src/lib/domain/) | `finance-metrics.ts` (every PRD §6 metric, card dues), `periods.ts` (month and date helpers), `budgets.ts` (budget summary, copy plan), `recurring.ts` (scheduler), `analysis.ts` |
| Storage | [lib/storage/](../../../artifacts/financial-clarity/src/lib/storage/) | `keys.ts` (key catalogue), `schemas.ts` (type guards), `finance-storage.ts` (persist-first writes with rollback), `finance-read.ts`, `local-migrations.ts`, `migrations.ts`, `startup.ts` (storage check, quarantine) |
| Platform | [lib/platform/](../../../artifacts/financial-clarity/src/lib/platform/) | `share-image.ts`. Google auth and Drive still live in `lib/googleAuth.ts` and `lib/googleDrive.ts` (ARCHITECTURE A14) |
| Formatting | [lib/format.ts](../../../artifacts/financial-clarity/src/lib/format.ts) | `formatAmount` (compact), `formatAmountFull` (inputs, confirmations), `formatAmountShort` (charts) |

## Context providers
- [FinanceContext.tsx](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx)
  — state for transactions, categories, budgets, recurring rules, savings
  targets, and the selected month. The only writer of finance entities. Writes
  go through `lib/storage/finance-storage.ts` first; React state changes only
  after a successful write. Exposes selectors backed by `lib/domain/`.
- [FabContext.tsx](../../../artifacts/financial-clarity/src/context/FabContext.tsx)
  — per-screen FAB action or speed-dial menu. See [features/fab.md](../features/fab.md).
- [SecurityContext.tsx](../../../artifacts/financial-clarity/src/context/SecurityContext.tsx)
  — PIN + biometric lock, failed attempts, and cooldown.
- [BackupContext.tsx](../../../artifacts/financial-clarity/src/context/BackupContext.tsx)
  — Drive backup / restore orchestration and banner state.
- [MonthEndReviewContext.tsx](../../../artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx)
  — pending-month detection and Skip / Dismiss / Complete state. See
  [features/month-end-review.md](../features/month-end-review.md).

## Screen layout
Screens live under [src/pages/](../../../artifacts/financial-clarity/src/pages/):
Dashboard, Transactions, Budgets, Analysis, Settings, Profile, Categories,
RecurringExpenses, SavingsGoals, Security, BackupRestore, Changelog
(What's New), and not-found. One feature entry per screen exists in
[features/](../features/).

## Reusable components of note
- [ProfileAvatar.tsx](../../../artifacts/financial-clarity/src/components/ProfileAvatar.tsx) — round Google profile picture with initial and icon fallbacks; used on Settings, Profile, and the Backup card (DESIGN §5.21).
- [FAB.tsx](../../../artifacts/financial-clarity/src/components/FAB.tsx) — floating action button; a single action or a speed-dial menu.
- [TransactionSheet.tsx](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx) — entry sheet with calculator, Indian comma grouping, and the "Paid with credit card" checkbox.
- [BudgetSummaryCard.tsx](../../../artifacts/financial-clarity/src/components/BudgetSummaryCard.tsx) — the one budget summary shared by Budgets and Analysis Overview (ADR-0010).
- [card/](../../../artifacts/financial-clarity/src/components/card/) — `CardDuesSheet` (outstanding card amount, record a bill payment, card activity) and `CardPurchaseBadge`.
- [PeriodSelector.tsx](../../../artifacts/financial-clarity/src/components/PeriodSelector.tsx) — month selector shared by Dashboard and Analysis.
- [BudgetSheet.tsx](../../../artifacts/financial-clarity/src/components/BudgetSheet.tsx) — budget entry.
- [Navigation.tsx](../../../artifacts/financial-clarity/src/components/Navigation.tsx) — sidebar (desktop) + bottom nav (mobile).
- [LockScreen.tsx](../../../artifacts/financial-clarity/src/components/LockScreen.tsx), [PinSetupDialog.tsx](../../../artifacts/financial-clarity/src/components/PinSetupDialog.tsx) — security flows.
- [StartupErrorScreen.tsx](../../../artifacts/financial-clarity/src/components/StartupErrorScreen.tsx), [StorageNoticeBanner.tsx](../../../artifacts/financial-clarity/src/components/StorageNoticeBanner.tsx) — storage check failures and quarantine notice.
- [BackupSettingsCard.tsx](../../../artifacts/financial-clarity/src/components/BackupSettingsCard.tsx), [BackupOverwriteDialog.tsx](../../../artifacts/financial-clarity/src/components/BackupOverwriteDialog.tsx), [RestorePreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/RestorePreviewDialog.tsx), [CsvImportPreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/CsvImportPreviewDialog.tsx), [ConnectDriveBanner.tsx](../../../artifacts/financial-clarity/src/components/ConnectDriveBanner.tsx) — backup, restore, and CSV flows.
- [MonthEndReviewBanner.tsx](../../../artifacts/financial-clarity/src/components/MonthEndReviewBanner.tsx), [FeedbackSheet.tsx](../../../artifacts/financial-clarity/src/components/FeedbackSheet.tsx).
- Feature folders: [analysis/](../../../artifacts/financial-clarity/src/components/analysis/),
  [month-end/](../../../artifacts/financial-clarity/src/components/month-end/),
  [onboarding/](../../../artifacts/financial-clarity/src/components/onboarding/),
  [icons/](../../../artifacts/financial-clarity/src/components/icons/),
  [ui/](../../../artifacts/financial-clarity/src/components/ui/).

## Other library helpers
Under [src/lib/](../../../artifacts/financial-clarity/src/lib/):
- `finance-utils.ts` — compatibility re-exports of `lib/format.ts`, `lib/domain/periods.ts`, and `isConsumptionExpense`, plus deprecated aliases (`formatINR`, `formatShortINR`). New code imports from the source modules.
- `analysis-utils.ts` — Analysis helpers built on `lib/domain/`.
- `backup.ts` (schema v6), `backupHash.ts` — backup serialization, migration, and integrity hash.
- `csv.ts` — CSV import/export with formula-cell guards.
- `category-rules.ts` — used/reserved category rules.
- `month-end-review.ts` — month-end snapshot.
- `changelog.ts` — bundled What's New entries.
- `biometric.ts`, `security.ts`, `screen-security.ts` — lock and `FLAG_SECURE`.

## Persistence model
LocalStorage only, reached through `lib/storage/`. Keys use the frozen
`financial-clarity:` prefix and are listed in `lib/storage/keys.ts`. Startup
runs the local migrations (`storage-version` 3) and quarantines unreadable
records with a visible notice. Cloud copies exist only as user-initiated
Google Drive backups; CSV covers transaction import and export. Non-finance
modules (security, onboarding, month-end review, Google profile cache, backup
preferences) still call `localStorage` directly.

## Known gotchas
- `FinanceContext` is about 1,400 lines and mixes state, rules, and
  persistence (ARCHITECTURE A10).
- The app ships as a single ~1.2 MB JS chunk (ARCHITECTURE A16).
- Analysis panes change on a swipe beyond 25% of the pane width or faster
  than 500 px/s; see [features/analysis.md](../features/analysis.md).
