# Implementation review — Phases 1 to 10

**Date:** 2026-11-12
**Scope:** Implementation of [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) Phases 1–10, run as one loop at the owner's request.
**Status:** In progress. Updated at the end of each phase.

This report records what each phase completed, what is still open and why,
and every decision taken along the way. The per-phase summary also lives in
the "Implementation status" section of the implementation plan.

---

## Decision log

Decisions marked **Owner** were answered by the owner in the conversation.
Decisions marked **Agent** were taken by the coding agent under the owner's
instruction to run every phase; each one follows the documents where they
give an answer and picks the most conservative option where they do not.
Anything the PRD labels Pending, Deferred, or Future was not implemented.

| # | Phase | Decision | By | Reason |
|---|---|---|---|---|
| 1 | All | Each phase is committed on its own branch, created from the previous phase's branch. Nothing is pushed. | Agent | `main` does not contain the earlier phases yet, so branching from `main` would lose them. The owner approved commits but not pushes. |
| 2 | 1 | SMS removal was already done in code (commit `0894de1`); Phase 1 added regression guards and docs only. | Agent | Avoid re-doing finished work. |
| 3 | 2 | Local migration 2 (`budgets.month`) ships with Phase 4 and backup v5, not Phase 2. | Owner | Pairs the local and backup schema changes. |
| 4 | 2 | Non-finance modules get centralized key names only; their read/write behavior is unchanged. | Owner | Keep Phase 2 small. |
| 5 | 2 | A quarantined key is not rewritten at launch; identical quarantine copies are not saved twice. | Agent | Never change stored data without a user action; stops repeated copies filling storage. |
| 6 | 2 | When a quarantine copy cannot be saved, startup offers **Continue without it** behind a destructive confirmation. | Agent | DESIGN §8.2 allows overwriting only with explicit confirmation; without it a full store would lock the user out. |
| 7 | 2 | A legacy single-bucket savings goal is converted into the two-bucket shape when a backup is built (it used to be left out). | Agent | Same conversion the app already applies when loading; avoids losing it from backups. |
| 8 | 3 | Phase 3 replaces only page sums that duplicate a PRD §6 metric; Analysis-only figures wait for Phase 7 and Transactions totals for Phase 6. | Owner | Matches the phase split in the plan. |
| 9 | 3 | One formatter module with three variants; screens keep their current look until Phase 9; display never shows paise. | Owner | Visual change belongs to design alignment. |
| 10 | 3 | The Transactions page total will show consumption spending, labeled "Spending" (applied in Phase 6). | Owner | PRD §6 definition. |
| 11 | 3 | `formatINR`, `formatShortINR`, and `formatMonthYear` stay as deprecated aliases instead of renaming about 100 call sites. | Agent | Avoid a large rename-only diff; Phase 9 touches each call site anyway. |
| 12 | 3 | Budget "spent" is savings contributions for a savings category and consumption for any other category, so card bill payments no longer count. | Agent | PRD §6 consumption definition; savings budgets track contributions. |
| 13 | 3 | The month-end review snapshot is not changed even though it still counts card bill payments. | Agent | Month-end behavior is pending owner review (PRD D8, FR-09). |
| 14 | 4 | `Category.active` stays optional in TypeScript; absent means active. Migration 1, backup v5, and new categories store `true`. | Agent | Keeps pre-migration data readable everywhere; the migration guarantees stored values. |
| 15 | 4 | New transactions, new budgets, and new or edited recurring rules are refused in an inactive category; an edited transaction may keep its current inactive category. | Agent | DATABASE §6.2 and the PRD FR-03 assumption. The assumption is marked "requiring confirmation" in the PRD — **owner should confirm**. |
| 16 | 4 | An active recurring rule whose category becomes inactive keeps generating; it is not paused or deleted. | Agent | PRD FR-03 leaves this pending and forbids silently pausing or deleting the rule; no behavior change is the safe default. **Owner decision still needed.** |
| 17 | 4 | Reserved categories plus `other` and `other-income` can never be inactive; a stored inactive value is corrected at load. | Agent | DATABASE §6.2 (owner-approved in the database design review). |
| 18 | 4 | CSV import may still match an existing inactive category by name. | Agent | Import restores history rather than creating a new entry by choice. |
| 19 | 4 | Backup v4 → v5 leaves out a month-less budget that collides with an existing one instead of quarantining it. | Agent | Quarantine is local-only; the Drive file is unchanged and still holds the row. |
| 20 | 4 | Inactive categories are listed last within their type group with an "Inactive" badge instead of DESIGN §13's collapsible Inactive section. | Agent | Smaller change; the collapsible section is noted for Phase 9 design alignment. |
| 21 | 4 | The month-end budget planner hides inactive categories unless they already have a next-month budget. | Agent | Its `addBudget` result is ignored (existing month-end behavior), so offering an inactive category would fail silently. |
| 22 | 4 | Active category names are unique ignoring case; adding, renaming, or reactivating into a clash is refused. Inactive categories may share a name. | Agent | DATABASE §6.2 (owner-approved). |
| 23 | 5 | Recurring generation runs only while unlocked: once after unlock and on every return to the foreground (`visibilitychange`), plus after rule changes. It no longer runs when the data first loads. | Agent | ARCHITECTURE §6.4 and DATABASE §8.2 (no finance writes while locked). Uses the browser `visibilitychange` event so no Capacitor call is added to the context layer. |
| 24 | 5 | Deleting a generated occurrence still relies on the forward-only cursor; no permanent suppression list is added. | Agent | PRD FR-07 leaves permanent suppression pending; DATABASE §6.3 says the cursor is enough today. **Owner decision still needed.** |

---

## Phase results

### Phase 1 — Characterize the app and remove SMS

- **Completed:** SMS code, routes, plugin, permission, and dependencies confirmed absent; static guard test and e2e NAV-002 added; docs updated.
- **Pending:** merged release manifest inspection. **Reason:** no Android SDK on this machine.

### Phase 2 — Reliable local storage and migration boundaries

- **Completed:** key catalogue, shared validators, quarantine with dedupe and notice, startup storage check, migration runner, typed restore result. ADR 0005.
- **Pending:** non-finance modules still write `localStorage` directly and ignore write errors. **Reason:** owner chose keys-only for this phase.

### Phase 3 — Centralize financial rules and shared selectors

- **Completed:** one implementation per PRD §6 metric, shared period helpers and formatters, card bill payments no longer double counted, cross-screen consistency test.
- **Pending:** Transactions totals (Phase 6), Analysis-only figures (Phase 7), compact amount display (Phase 9), month-end snapshot (pending D8).

### Phase 4 — Category status, deletion rules, and data compatibility

- **Completed:** `active` flag with domain enforcement (new entries, budgets, recurring rules), built-in categories always active, pickers show active categories only (plus the edited entry's own), "Mark inactive/active" on the Categories screen, "Inactive" badges, local migrations 1 and 2 (with quarantine on budget collisions), backup schema v5 with v4 → v5 migration. ADR 0006. Unit, context, migration, backup, and e2e CAT-003 tests.
- **Pending:** owner confirmation of the PRD FR-03 picker assumption and of the inactive-category/active-recurring-rule detail (decisions 15–16). **Reason:** the PRD marks both as requiring confirmation; the safest documented behavior is implemented. Collapsible Inactive section (DESIGN §13) left for Phase 9. Unique active category names (DATABASE §6.2) were implemented in this phase.

### Phase 5 — Recurring expense scheduling

- **Completed:** the scheduler is a pure, tested planner (`lib/domain/recurring.ts`); `processRecurring` is single-flight and saves occurrences and cursors together; generation runs only after unlock and on resume; tests cover day 31 in short months, leap and non-leap February, catch-up after time away, repeated runs, interrupted saves, legacy matches, and paused/resumed rules. E2E REC-003. Clamping, paused-month skipping, and occurrence identity were already in place (ADR 0004).
- **Pending:** permanent suppression of a deleted occurrence (decision 24). **Reason:** PRD FR-07 marks it as an open product decision.