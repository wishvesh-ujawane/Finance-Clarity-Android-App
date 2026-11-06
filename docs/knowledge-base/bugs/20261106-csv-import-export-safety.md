---
id: bug-20261106-csv-import-export-safety
title: CSV round-trip duplicated savings as spending; export allowed formula injection; import had no preview
date: 2026-11-06
updated: 2026-11-06
status: fixed
scope: [financial-clarity, backup-restore, csv]
related:
  - ../features/backup-restore.md
  - ../../audits/2026-11-06-e2e-browser-audit.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/csv.ts
  - artifacts/financial-clarity/src/lib/finance-utils.ts
  - artifacts/financial-clarity/src/pages/BackupRestore.tsx
  - artifacts/financial-clarity/src/components/CsvImportPreviewDialog.tsx
---

# CSV round-trip duplicated savings as spending; export allowed formula injection; import had no preview

## Symptom
Found in the [2026-11-06 browser audit](../../audits/2026-11-06-e2e-browser-audit.md) (F-01, F-02, F-03):

- Exporting all transactions and importing the same file created a second
  "Emergency Fund" category of type `expense` and a duplicate ₹5,000
  transaction, which then counted as consumption spending.
- A note such as `=HYPERLINK("…")` was exported unchanged, so a spreadsheet
  would run it as a formula.
- Choosing a CSV file imported it immediately, with no preview.
- `2026-13-45` passed the date check; the first bad row aborted the whole file.

## Root cause
- Import looked up categories by `name|type`, using the CSV row type
  (`income` or `expense`). Savings categories have type `savings` and
  commitment categories `commitment`, so they never matched and were
  re-created as `expense` categories. The new category id then defeated the
  duplicate check.
- `escapeCsvCell` only doubled quotes.
- The date check was a `YYYY-MM-DD` regex, and the page called
  `addCategory` / `importTransactions` straight after parsing.

## Fix
- `buildTransactionsCsv` prefixes `'` to cells starting with `=`, `+`, `-`,
  `@`, tab, or carriage return; `parseTransactionsCsv` strips that guard, so
  notes round-trip unchanged.
- `parseTransactionsCsv` returns `{ rows, invalidRows }`, using
  `isValidDateStr` (new shared helper in `finance-utils.ts`) and a strict
  amount pattern. Missing required columns still reject the file.
- New pure `planCsvImport` resolves expense rows against savings,
  commitment, expense, then "both" categories by name, counts duplicates,
  and lists categories to create — without writing anything.
- `BackupRestore` shows `CsvImportPreviewDialog`; categories and
  transactions are written only on confirm. Files over 5 MB are refused.
  The CSV card says it is not a full backup (DESIGN §13.13, PRD FR-11).

## Tests
- [csv.test.ts](../../../artifacts/financial-clarity/src/lib/__tests__/csv.test.ts) — formula guard, round-trip,
  skip-invalid parsing with line numbers, date validation, import planning.
- [audit-2026-11-06.pw.ts](../../../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) — CSV-001 to CSV-004
  now pass (their `test.fail()` markers were removed).

## Lessons
- CSV carries category names, not ids, so any name lookup must consider every
  category type a row can map to.
- Data that leaves or enters the app goes through a preview and a guard, as
  ARCHITECTURE §6.6 and §15.1 (B3, B6) already required.
