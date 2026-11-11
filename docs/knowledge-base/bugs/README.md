# Bugs

Bug history and fixes — one entry per resolved (or actively-investigated) bug.
The "what went wrong and how we fixed it".

Use [`../_templates/bug.md`](../_templates/bug.md) for new entries.

File naming: `YYYYMMDD-<short-slug>.md` (date the bug was observed).

## Index

- [2026-11-06 — Card bill payments counted as spending on some screens](./20261106-card-bill-double-count.md) — fixed (Phase 3); month-end snapshot pending D8
- [2026-11-06 — Failed saves looked successful (finance writes ignored errors)](./20261106-swallowed-storage-writes.md) — fixed (E1–E3)
- [2026-11-11 — Recurring rules replayed paused months and used fuzzy occurrence matching](./20261111-recurring-paused-months.md) — fixed; Android verification outstanding
- [2026-11-06 — Back up now could replace a larger Drive backup with an empty or smaller one](./20261106-drive-backup-overwrite.md) — fixed
- [2026-11-06 — Categories with transactions, budgets, or recurring rules could be deleted](./20261106-used-category-deletion.md) — fixed
- [2026-11-06 — Locked app kept financial screens mounted; cooldown reset on restart; no Recents protection](./20261106-app-lock-exposure.md) — fixed
- [2026-11-06 — CSV round-trip duplicated savings as spending; formula injection; no import preview](./20261106-csv-import-export-safety.md) — fixed
- [2026-07-05 — Calculator operator keys dismissed keypad in Add/Edit Transaction](./20260705-tx-keypad-dismissal.md) — fixed
