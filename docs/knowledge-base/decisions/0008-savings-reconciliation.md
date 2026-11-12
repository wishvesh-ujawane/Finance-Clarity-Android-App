---
id: decision-0008
title: ADR-0008 — Savings-aware reconciliation and backup v6
date: 2026-11-12
updated: 2026-11-12
status: accepted
scope: [financial-clarity, month-end, storage, backup]
related:
  - ./0007-owner-decisions-d6-d9.md
  - ../features/month-end-review.md
  - ../bugs/20261112-savings-bank-reconciliation.md
source-of-truth-files:
  - docs/PRD.md
  - docs/DATABASE.md
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/backup.ts
---

# ADR-0008 — Savings-aware reconciliation and backup v6

## Context

Savings and emergency-fund contributions can be moved to accounts outside the bank being reconciled. The earlier expected-bank formula retained them, making those transfers look like missed spending. The owner wants savings retained in lifetime balance, an actual combined savings input, and only the discrepancy recorded. Unpaid card debt remains accounted for.

## Decision

- Expected bank balance through the month is cumulative lifetime balance minus tracked combined savings plus the unpaid card amount. Tracked savings include both reserved savings categories and confirmed corrections, through month end only.
- Confirming actual combined savings records only the difference as a transaction marked `savingsCorrection`: `increase`, `spent`, or `transfer`. It does not store a separate account-balance field or invent an allocation between savings categories. An increase affects lifetime and tracked savings; spent or lost reduces both; a bank transfer moves the amount from tracked savings to expected bank cash without changing lifetime.
- These corrections are not ordinary monthly income, consumption, or savings contributions. A bank gap is shown separately and is adjusted only on explicit confirmation. Earlier snapshots and adjustments stay unchanged.
- Reserve `_adjustment-savings` and use local migration 3 and backup v6. Refuse an older dataset or backup already using that ID rather than reuse it. Older backup versions upgrade without rewriting transactions; newer backups are refused. CSV identifies correction rows but cannot import them as ordinary transactions.

## Alternatives considered

- Add the whole entered savings balance to lifetime balance: rejected because recorded contributions are already retained and would be counted twice.
- Store a separate actual-balance snapshot: not needed for the requested flow; the user chose transaction-based correction.
- Treat every savings decrease as spending: rejected because a transfer back to bank has no effect on lifetime balance.

## Consequences

- The bank and lifetime figures measure different things while using one ledger. Corrections persist in full backups.
- Unrecorded interest, withdrawals, and existing mistaken bank adjustments are not guessed. The user must review discrepancies. The combined correction is not split by account.
- Corrections can be removed from Transactions with explicit confirmation; reconciliation snapshots and bank adjustments remain unchanged.
- Bank adjustment duplication on repeat reconciliation remains a separate pending review; this change prevents duplicating an unchanged savings correction.
- Android device validation is still required.

## Supersedes / superseded by

Amends ADR-0007 decision 4 by subtracting tracked separate savings from expected bank balance.
