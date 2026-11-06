# Knowledge Base Changelog

Append-only. One line per Oracle update. Newest at the top.

Format: `YYYY-MM-DD — <category>/<slug>.md — <one-line summary>`

---

2026-11-06 — bugs/20261106-app-lock-exposure.md, features/security.md — Nothing but the lock screen renders while locked; focus is trapped; failed attempts and an escalating cooldown (30 s → 1 min → 5 min → 15 min) persist in security settings; `FLAG_SECURE` is set while the app lock is on (owner decision). Fixes audit F-04, F-09, F-13.
2026-11-06 — bugs/20261106-csv-import-export-safety.md, features/backup-restore.md — CSV export guards formula cells; import shows a preview, skips invalid rows (real calendar dates, strict amounts), maps savings/commitment rows back to their categories, and refuses files over 5 MB. Fixes audit F-01–F-03.
2026-11-06 — audits/2026-11-06-cleanup-phases-3-4-review.md, ARCHITECTURE.md §19 — Recorded cleanup Phases 3 and 4 for owner review (not implemented). Added gaps A12 (screens re-sum transactions with different rules; confirmed Dashboard/Transactions drift), A13 (defeated lazy imports), A14 (non-conforming file names), A15 (Drive error logging), A16 (1.2 MB bundle).
2026-11-06 — architecture/workspace.md — Rewritten for the single-package workspace: removed server/DB/API-codegen scaffolds, `mockup-sandbox`, the empty `@workspace/scripts` package, and all Replit config; core docs now live in `docs/`; build scripts moved to `scripts/`.
2026-11-06 — environment/build-and-test.md — Commands updated: no `typecheck:libs`, codegen, or `db push`; added Playwright e2e and the `scripts/*.ps1` Android build helpers.
2026-11-06 — environment/security-baseline.md — Corrected location of `minimumReleaseAge` (it is in `pnpm-workspace.yaml`, not `.npmrc`); the `@replit/*` and `stripe-replit-sync` exclusions were removed, so there are no exceptions.
2026-11-06 — architecture/{api-server,api-spec,api-client-react,api-zod,db,mockup-sandbox}.md, api/openapi.md — Marked `deprecated`: packages deleted from the workspace (app is local-only: on-device storage, Google Drive backup, CSV import/export).
2026-11-06 — architecture/financial-clarity.md, glossary.md, architecture/README.md, api/README.md — Removed references to the deleted scaffolds; noted Drive backup and CSV as the only data paths off the device.
2026-11-06 — AGENTS.md §1.1, §3.1, §5, §7; ARCHITECTURE.md §2.1, §2.3, §5, §7.1, §8.3, §10.4, §13, §18; DATABASE.md §1, §6.1 — Phase 2 cleanup: removed `date-fns`, `zod`, `react-hook-form`, `@hookform/resolvers` (never used); validation is documented as hand-written TypeScript type guards, dates as the shared `finance-utils` helpers. Core docs moved to `docs/`.
2026-11-06 — ARCHITECTURE.md §2.3, §19 A6 — Phase 1 dead-code cleanup in `artifacts/financial-clarity`: removed the unused React Query provider, 42 unreachable `components/ui` primitives, `hooks/use-mobile.tsx`, unused exports (`getMonthSavingsTotal`, `formatINRCompact`, `isMonthFullyPast`, `_today`, `PAYMENT_METHODS`, `SavingsCategoryId`, `SystemAdjustmentCategoryId`, `GoalEntry`), the dead `@assets` Vite alias, and 31 app packages used only by that code. No behavior change. `react-hook-form`, `@hookform/resolvers`, `date-fns`, and `zod` are kept pending an owner decision because AGENTS §5 names them.
2026-08-31 — features/transactions.md — Amount input now applies live Indian comma grouping (`1,23,456`) while typing; preserves operators in calculator expressions (`10,000+2,500`); cursor position is preserved across reformats. New helpers `formatIndianDigits` / `formatAmountExpression` in finance-utils.ts with unit tests.
2026-07-05 — features/month-end-review.md — Added spending-breakdown donut chart to step 1 and live "Budget allocated" tracker (income-ratio bar + delta chip) to step 2. No new dependencies.
2026-07-05 — features/month-end-review.md — New feature entry for the two-step Month-End Review flow (analysis + guided budget setup + home-screen banner + confetti).
2026-07-05 — decisions/0003-month-end-review-flow.md — ADR-0003 accepted: trigger rule, impulse heuristic, 3-month budget suggestion, no new confetti dependency.
2026-07-05 — features/dashboard.md — Documented the new `MonthEndReviewBanner` above `ConnectDriveBanner`.
2026-07-05 — architecture/financial-clarity.md — Added `MonthEndReviewContext` and `components/month-end/` group.
2026-07-05 — requirements/20260705-feature-backlog.md — Feature brainstorm backlog captured (30+ ideas across capture, insights, planning, income, safety, delight, big-bets); includes Trends per-month category-wise spend.
2026-07-05 — environment/build-and-test.md — Added Vitest test commands for financial-clarity app.
2026-07-05 — api/openapi.md — Marked OpenAPI spec as placeholder; only `/healthz` endpoint exists; app is localStorage-only.
2026-07-05 — architecture/api-server.md — Marked API server as placeholder; only health route exists; app has no backend dependency.
2026-07-05 — architecture/db.md — Marked database package as placeholder; app is localStorage-only with no Postgres dependency.
2026-07-05 — financial-clarity — Added Vitest + Testing Library infrastructure; added safe currency input parser (`parseCurrencyInput`) to replace unsafe `parseFloat` on money inputs across Budgets, RecurringExpenses, SavingsGoals; added safety comment to chart.tsx `dangerouslySetInnerHTML`.
2026-06-28 — bugs/20260628-budgets-analysis-divergence.md — Recorded headline-budget divergence between Budgets and Analysis screens; fixed in `bb1afa7`.
2026-06-28 — decisions/0002-canonical-budget-summary.md — ADR-0002 accepted: `BudgetSummary` / `getBudgetSummary` are the single source for headline budget math.
2026-06-28 — features/budgets.md — Added "Math" section pinning headline / over-under definitions and the savings-shown-separately rule.
2026-06-28 — features/analysis.md — Added "Budget Health card" section under Overview and documented full-month vs to-date Commitments distinction.
2026-06-28 — glossary.md — Added: Commitment, Day-to-day spend, Monthly budget total, Savings budget, Spent on budgeted.
2026-06-28 — features/recurring-expenses.md — Added note clarifying that materialised recurring transactions are ordinary expense transactions and that commitment-counting follows category type.
2026-06-28 — meta/bootstrap — Knowledge base scaffolded and App Oracle agent created (see [decisions/0001-knowledge-base-bootstrap.md](./decisions/0001-knowledge-base-bootstrap.md)).
2026-06-28 — architecture/workspace.md — Initial workspace overview seeded from `replit.md` and `pnpm-workspace.yaml`.
2026-06-28 — architecture/financial-clarity.md — Initial Financial Clarity architecture seeded from existing exploration notes.
2026-06-28 — architecture/api-server.md — Initial API server overview seeded.
2026-06-28 — architecture/api-spec.md — Initial API spec / Orval codegen overview seeded.
2026-06-28 — architecture/api-zod.md — Initial generated Zod schema package overview seeded.
2026-06-28 — architecture/api-client-react.md — Initial generated React Query client overview seeded.
2026-06-28 — architecture/db.md — Initial Drizzle DB package overview seeded.
2026-06-28 — architecture/mockup-sandbox.md — Initial mockup sandbox overview seeded.
2026-06-28 — features/dashboard.md — Initial Dashboard feature entry seeded.
2026-06-28 — features/budgets.md — Initial Budgets feature entry seeded.
2026-06-28 — features/analysis.md — Initial Analysis feature entry seeded.
2026-06-28 — features/transactions.md — Initial Transactions feature entry seeded.
2026-06-28 — features/categories.md — Initial Categories feature entry seeded.
2026-06-28 — features/recurring-expenses.md — Initial Recurring Expenses feature entry seeded.
2026-06-28 — features/savings-goals.md — Initial Savings Goals feature entry seeded.
2026-06-28 — features/security.md — Initial Security feature entry seeded.
2026-06-28 — features/settings.md — Initial Settings feature entry seeded.
2026-06-28 — features/backup-restore.md — Initial Backup & Restore feature entry seeded.
2026-06-28 — features/onboarding.md — Initial Onboarding feature entry seeded.
2026-06-28 — features/fab.md — Initial FAB component behavior entry seeded.
2026-06-28 — api/openapi.md — Initial OpenAPI / codegen overview seeded.
2026-06-28 — environment/build-and-test.md — Initial build / test / typecheck commands seeded.
2026-06-28 — environment/security-baseline.md — Initial pnpm supply-chain hardening notes seeded.
2026-06-28 — glossary.md — Initial glossary seeded.
2026-06-28 — decisions/0001-knowledge-base-bootstrap.md — ADR-0001 recorded: knowledge base + Oracle introduced.
