---
id: decision-0006
title: ADR-0006 — Category status, required budget month, and backup schema v5
date: 2026-11-12
updated: 2026-11-12
status: accepted
scope: [financial-clarity, categories, budgets, storage, backup]
related:
  - ./0005-storage-startup-and-migrations.md
  - ../features/categories.md
source-of-truth-files:
  - docs/PRD.md
  - docs/DATABASE.md
  - artifacts/financial-clarity/src/lib/category-rules.ts
  - artifacts/financial-clarity/src/lib/storage/local-migrations.ts
  - artifacts/financial-clarity/src/lib/backup.ts
---

# ADR-0006 — Category status, required budget month, and backup schema v5

## Context

PRD FR-03 and D6 approve active/inactive categories. DATABASE §10.1 plans
local migration 1 (`categories.active`) and migration 2 (every budget has a
month), and §10.2 plans backup schema v5 for both. The owner authorized all
implementation phases on 2026-11-12 and earlier chose to ship migration 2
with this phase.

## Decision

1. `Category.active` is an optional boolean in TypeScript; an absent value
   means active. Migration 1, backup v5, and every new category store `true`.
   The type stays optional so data and tests from before the migration remain
   valid.
2. Domain rules (`lib/category-rules.ts`, enforced in `FinanceContext`):
   - Reserved categories plus `other` and `other-income` can never be
     inactive; an inactive stored value is corrected at load.
   - New transactions, new budgets, and new or edited recurring rules are
     refused in an inactive category (DATABASE §6.2).
   - An edited transaction may keep its current inactive category (PRD FR-03
     assumption, pending owner confirmation).
   - Recurring generation for an existing active rule is not affected
     (PRD FR-03 pending detail: no pause, no delete).
   - CSV import may match an existing inactive category, because it restores
     history.
3. Pickers offer active categories only, plus the current category of the
   entry being edited.
4. Local migration 2 gives each month-less budget the current month. On a
   collision with a budget that already had that month, the existing row is
   kept and the original `budgets` text is quarantined before the write.
5. Backup v4 → v5 applies the same two rules. A month-less budget that
   collides is left out of the restore; the backup file on Drive is not
   modified, so it can still be recovered from there. Newer backups (v6+) are
   refused.
6. Validators stay lenient (`month` and `active` optional) as defense in
   depth; the migrations guarantee the stored values.

## Alternatives considered

- Make `active` required in TypeScript. Rejected: it would break reading
  pre-migration data in tests and in a failed-migration fallback without
  adding safety.
- Quarantine dropped budgets during backup restore. Rejected: quarantine is a
  local-storage concept; the source file already preserves the row.
- Block edited transactions from keeping an inactive category. Rejected: the
  PRD assumption and DATABASE §6.2 both allow it.

## Consequences

- Positive: categories can be retired without losing history; budgets always
  have a month, so a legacy budget no longer moves to the current month on
  every launch.
- Negative: the "inactive category vs active recurring rule" and picker
  details remain owner decisions; the current behavior follows the documented
  assumption and can change later without a migration.
- Follow-ups: owner confirmation of the PRD FR-03 assumption and pending
  detail. DESIGN §13 asks for a collapsible Inactive section on the
  Categories screen; this change lists inactive rows last with a badge.

## Supersedes / superseded by

None.
