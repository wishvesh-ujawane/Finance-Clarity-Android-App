# Knowledge Base Changelog

Append-only. One line per Oracle update. Newest at the top.

Format: `YYYY-MM-DD — <category>/<slug>.md — <one-line summary>`

---

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
