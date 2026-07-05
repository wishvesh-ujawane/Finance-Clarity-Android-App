---
id: architecture-financial-clarity
title: Financial Clarity app
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./workspace.md
  - ../features/dashboard.md
  - ../features/budgets.md
  - ../features/analysis.md
  - ../features/fab.md
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
---

# Financial Clarity app

## Purpose
Personal money-manager app — dashboard, budgets, recurring expenses, analysis,
backup/restore — packaged as both a Vite web app and a Capacitor-wrapped
Android app. Local-only persistence (localStorage); no API server dependency.

## Tech
- React 19, Vite, TypeScript ~5.9
- Tailwind CSS (deep-blue palette; Manrope + Inter)
- Recharts (donut + bar charts)
- Framer Motion (sheets, swipes, FAB)
- Lucide React (icons)
- Capacitor (Android wrapper) — see [android/](../../../artifacts/financial-clarity/android/)

## Entry points
- [src/main.tsx](../../../artifacts/financial-clarity/src/main.tsx) — React root.
- [src/App.tsx](../../../artifacts/financial-clarity/src/App.tsx) — top-level
  layout + routes + context providers.
- [capacitor.config.ts](../../../artifacts/financial-clarity/capacitor.config.ts)
  — Android wrapper config.

## Context providers
- [FinanceContext.tsx](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx)
  — global state for transactions, categories, budgets, recurring expenses,
  savings goal, selectedMonth; mirrors all writes to localStorage.
- [FabContext.tsx](../../../artifacts/financial-clarity/src/context/FabContext.tsx)
  — per-screen FAB action registration via the `useFabAction` hook. See
  [features/fab.md](../features/fab.md).
- [SecurityContext.tsx](../../../artifacts/financial-clarity/src/context/SecurityContext.tsx)
  — PIN + biometric lock state.
- [BackupContext.tsx](../../../artifacts/financial-clarity/src/context/BackupContext.tsx)
  — backup / restore orchestration including Drive banner state.
- [MonthEndReviewContext.tsx](../../../artifacts/financial-clarity/src/context/MonthEndReviewContext.tsx)
  — pending-month detection + Skip / Dismiss / Complete state for the
  Month-End Review flow. See
  [features/month-end-review.md](../features/month-end-review.md).

## Screen layout
Screens live under [src/pages/](../../../artifacts/financial-clarity/src/pages/):
Dashboard, Budgets, Analysis, Transactions, Categories, RecurringExpenses,
SavingsGoals, Security, Settings, BackupRestore. One feature entry per screen
exists in [features/](../features/).

## Reusable components of note
- [components/FAB.tsx](../../../artifacts/financial-clarity/src/components/FAB.tsx)
  — global floating action button (always blue `bg-accent`, always Plus icon).
- [components/TransactionSheet.tsx](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx)
  — Framer Motion bottom sheet for transaction entry.
- [components/Navigation.tsx](../../../artifacts/financial-clarity/src/components/Navigation.tsx)
  — sidebar (desktop) + bottom nav (mobile).
- [components/LockScreen.tsx](../../../artifacts/financial-clarity/src/components/LockScreen.tsx),
  [PinSetupDialog.tsx](../../../artifacts/financial-clarity/src/components/PinSetupDialog.tsx)
  — security flows.
- [components/BackupSettingsCard.tsx](../../../artifacts/financial-clarity/src/components/BackupSettingsCard.tsx),
  [RestorePreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/RestorePreviewDialog.tsx),
  [ConnectDriveBanner.tsx](../../../artifacts/financial-clarity/src/components/ConnectDriveBanner.tsx)
  — backup / Drive flows.
- [components/analysis/](../../../artifacts/financial-clarity/src/components/analysis/),
  [components/onboarding/](../../../artifacts/financial-clarity/src/components/onboarding/),
  [components/month-end/](../../../artifacts/financial-clarity/src/components/month-end/),
  [components/icons/](../../../artifacts/financial-clarity/src/components/icons/),
  [components/ui/](../../../artifacts/financial-clarity/src/components/ui/)
  — grouped feature components.

## Library helpers
Under [src/lib/](../../../artifacts/financial-clarity/src/lib/):
- `finance-utils.ts` — `formatINR`, `formatAmount`, `formatMonthLabel`,
  `addMonths`, `getMonthOverMonthChange`.
- `analysis-utils.ts` — derived metrics for the Analysis screen.
- `backup.ts`, `backupHash.ts` — serialization + integrity hash for backups.
- `biometric.ts` — Capacitor biometric bridge.
- `crashlytics.ts` — Firebase Crashlytics wrapper.
- `csv.ts` — CSV import/export.

## Persistence model
LocalStorage only. `FinanceContext` is the canonical reader/writer. No API
client is wired in. The OpenAPI / Drizzle stack is reserved for future
server-backed features and currently does not back this app.

## Known gotchas
- FAB has no per-screen color or icon override — every screen sees the same
  blue plus button. See [features/fab.md](../features/fab.md).
- Analysis screen swipe uses pixel-OR-percent threshold (50px or 18% of pane
  width); see [features/analysis.md](../features/analysis.md).
- Surplus bar on Budgets uses hardcoded `[hsl(222,65%,13%)]` rather than a
  Tailwind theme token.
