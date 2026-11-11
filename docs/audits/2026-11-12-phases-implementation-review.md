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
