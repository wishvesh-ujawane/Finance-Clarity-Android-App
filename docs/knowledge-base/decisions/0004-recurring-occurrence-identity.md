---
id: decision-0004
title: ADR-0004 — Stable recurring occurrence identity
date: 2026-11-11
updated: 2026-11-11
status: accepted
scope: [financial-clarity, recurring-expenses, backup]
related:
  - ../bugs/20261111-recurring-paused-months.md
source-of-truth-files:
  - docs/PRD.md
  - docs/DATABASE.md
  - artifacts/financial-clarity/src/lib/types.ts
  - artifacts/financial-clarity/src/lib/backup.ts
---

# ADR-0004 — Stable recurring occurrence identity

## Context

Recurring generation identified an existing entry by comparing description,
amount, category, and month. A matching manual transaction could suppress a
valid occurrence, while edits to a generated transaction could defeat the
match and allow a duplicate. Paused rules also needed an unambiguous cursor
for catch-up and resume behavior.

## Decision

Generated transactions carry an optional `recurringRuleId` and
`recurringMonth` pair. New occurrences are deduplicated by this pair. Existing
transactions without the pair remain valid; a narrow exact-scheduled-date
fallback handles legacy generated entries whose old write/cursor updates were
interrupted. Backup schema v4 adds the optional pair and upgrades v1–v3
backups without changing their transaction records.

When a paused rule resumes, advance its forward-only cursor through due
occurrences strictly before the resume date. An occurrence due on the resume
date remains eligible. Short-month dates are clamped before comparison.

## Alternatives considered

- Continue matching all candidate transactions by description, amount,
  category, and month. Rejected because user-authored transactions can match
  and edits can cause duplicate occurrences.
- Add identity only to recurring rules. Rejected because the scheduler must
  distinguish each monthly occurrence, and generated transactions must keep
  provenance after their rule is deleted.
- Rewrite historical transactions during restore. Rejected because legacy
  records cannot be attributed reliably without the original rule data.

## Consequences

- Positive: new occurrences have stable identity, retries do not duplicate
  them, and ordinary transaction edits do not change the deduplication key.
- Negative: old entries have no provenance. A narrow compatibility match is
  still needed for interrupted pre-v4 writes and remains ambiguous when a
  manual entry exactly matches the old scheduled date and fields.
- Follow-ups: verify backup v1–v3 restoration and repeated generation on an
  Android device. Category `active` remains a separate planned backup v5
  migration.

## Supersedes / superseded by

None.