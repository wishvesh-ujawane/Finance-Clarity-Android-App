# Decisions (ADRs)

Architecture Decision Records — numbered, immutable. The "why".

Use [`../_templates/decision.md`](../_templates/decision.md) for new ADRs.

File naming: `NNNN-<short-slug>.md`, zero-padded, monotonic.

Rules:
- ADRs are **not edited in place** after acceptance.
- To revise an accepted decision, create a new ADR and set the old one's
  `status: superseded` with a `superseded by` link.

## Index

- [0001-knowledge-base-bootstrap.md](./0001-knowledge-base-bootstrap.md) — Introduce the App Oracle subagent and the committed knowledge base.
- [0004-recurring-occurrence-identity.md](./0004-recurring-occurrence-identity.md) — Give generated recurring transactions stable rule/month identity; backup schema v4.
- [0005-storage-startup-and-migrations.md](./0005-storage-startup-and-migrations.md) — One key catalogue and validator set, quarantine with dedupe and visible notice, startup storage check, local migration runner.
- [0006-category-status-and-backup-v5.md](./0006-category-status-and-backup-v5.md) — Active/inactive categories, local migrations 1–2, backup schema v5.
- [0007-owner-decisions-d6-d9.md](./0007-owner-decisions-d6-d9.md) — Active recurring rules block category inactivation; month-end card bill payments and card-aware reconcile; crash reporting removed.
- [0008-savings-reconciliation.md](./0008-savings-reconciliation.md) — Separate savings from bank reconciliation and record confirmed corrections; backup schema v6.
- [0009-ui-lint-and-accessibility-tooling.md](./0009-ui-lint-and-accessibility-tooling.md) — ESLint and axe accessibility checks for the mobile UI.
- [0010-card-dues-budget-summary-trends.md](./0010-card-dues-budget-summary-trends.md) — "Paid with credit card" checkbox; tappable card chip that records bill payments on their date; one shared budget summary; new Trends cards.
