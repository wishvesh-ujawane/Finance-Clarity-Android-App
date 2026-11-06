---
date: 2026-11-06
scope: "code cleanup — Phase 3 (duplicate/inconsistent code) and Phase 4 (reliability/privacy debt), deferred for owner review"
auditor: coding-agent (AGENTS.md)
status: pending-owner-review
oracle-consulted: false
manual-walkthrough: skipped
dev-server: "not used"
features-covered: [dashboard, transactions, analysis, backup, security, onboarding, month-end-review]
---

# Cleanup review — Phases 3 and 4 (pending owner review)

## Summary

A full static review of `artifacts/financial-clarity` produced a four-phase cleanup plan.
Phases 1 and 2 are **done** (branch `chore/remove-dead-code`, 2026-11-06). Phases 3 and 4
are recorded here **for review only. Nothing in this report is implemented or authorized.**
Each item needs owner approval under AGENTS.md §1.3 and the PRD §15 execution rule.

Counts by severity (rubric in [README.md](./README.md#severity-rubric)):
**P0=0, P1=2, P2=7, P3=4.**

The two P1s are the ones to look at first:

- **P4-1:** storage write failures are swallowed, so a failed save can look successful.
- **P3-3:** some screens compute their own spending totals with different rules from the
  shared ones, so the same month can show different figures on different screens.

### Already completed (context)

| Phase | Result |
|---|---|
| 1 — Dead code | Removed 42 unreachable `components/ui` files, `hooks/use-mobile.tsx`, unused exports, the React Query provider, the dead `@assets` alias, and 31 unused packages. ARCHITECTURE §19 A6 resolved. |
| 2 — Workspace residue | Removed Replit config, plugins, and allow-list entries; the server/DB/API-codegen scaffolds; `mockup-sandbox`; the empty `@workspace/scripts` package; and `date-fns`, `zod`, `react-hook-form`, `@hookform/resolvers`. Moved core docs into `docs/` and build scripts into `scripts/`. |

## Evidence gathered

Run on 2026-11-06 against the working tree of `chore/remove-dead-code`:

- `pnpm run typecheck`: pass.
- `pnpm --filter @workspace/financial-clarity run test:run`: 75/75 pass.
- `pnpm --filter @workspace/financial-clarity run test:e2e`: 12/12 pass (desktop + mobile viewport).
- `pnpm run build`: pass. Main JS chunk 1,207.57 kB (above Vite's 500 kB warning); CSS 89.68 kB.
- Static analysis: full import/export graph from `main.tsx`, package-usage scan, and targeted greps.
  Line numbers below are from this run.

---

## Phase 3 — Duplicate and inconsistent code

Behavior-sensitive. Add tests that pin current behavior before changing any of these.

| ID | Sev | Finding | Evidence | Proposed approach | Decision needed | Tracked as |
|---|---|---|---|---|---|---|
| P3-1 | P2 | **Two money formatters.** `formatINR` (full digits, `₹1,50,000`) has 91 call lines in 12 files. The canonical `formatAmount` (`₹1.50 L` from 1 lakh up) is used only on the Dashboard. The same amount is shown differently on different screens. | [finance-utils.ts](../../artifacts/financial-clarity/src/lib/finance-utils.ts) lines 1, 16. Heaviest users: `OverviewPane.tsx` (25), `PlanningPane.tsx` (16), `Budgets.tsx` (12) | Migrate screen by screen to `formatAmount`; then delete `formatINR`. Add formatter tests for signs, grouping, lakh/crore thresholds | Switching changes what users see (`₹1,50,000` → `₹1.50 L`). Confirm DESIGN §4.6 applies everywhere, including tables and charts | ARCHITECTURE A5; DESIGN G8 |
| P3-2 | P2 | **Storage keys and `localStorage` access are scattered.** Key strings are defined in 7 modules and `localStorage` is called directly in 7 modules. `backup.ts` keeps its own copy of the finance key list. | `FinanceContext.tsx` 192–197; `BackupContext.tsx` 41–42; `backup.ts` 54–63; `security.ts` 1–2; `onboarding.ts` 7–9, 53; `month-end-review.ts` 15; `googleAuth.ts` 26 | One key catalogue in `lib/storage/`; route every read/write through it. **Key names must not change.** Do it incrementally (AGENTS §3.2) | None, if key names stay identical | ARCHITECTURE A10, §8.2; DATABASE §3 |
| P3-3 | **P1** | **Screens re-sum transactions with different rules.** AGENTS §5 requires one implementation per metric. Confirmed drift: Dashboard "today's spend" excludes savings but **includes credit-card bill payments**, which `isConsumptionExpense` excludes to avoid double counting. The Transactions list total counts **savings and card payments** as expenses. | [Dashboard.tsx](../../artifacts/financial-clarity/src/pages/Dashboard.tsx) 62–64; [Transactions.tsx](../../artifacts/financial-clarity/src/pages/Transactions.tsx) 108–109, 286–287; `OverviewPane.tsx` 185; `PlanningPane.tsx` 81; `useAnalysisShared.ts` 70–110. Canonical rule: `isConsumptionExpense` in `finance-utils.ts` | Add shared selectors (for example "consumption spend for a date range"); replace page-level sums; add a cross-screen consistency test | Is the Transactions total meant to be a raw list total or consumption spend? Label it accordingly | **New:** ARCHITECTURE A12 |
| P3-4 | P2 | **Backup app version is hard-coded.** Every backup records `1.0.0` even though the build already exposes `__APP_VERSION__`. | [backup.ts](../../artifacts/financial-clarity/src/lib/backup.ts) 66; `vite.config.ts` `define` | Use `__APP_VERSION__`; keep accepting old backups that say `1.0.0` | None | ARCHITECTURE A7 |
| P3-5 | P3 | **Lazy imports that split nothing.** The same Capacitor modules are imported both statically and dynamically, so the dynamic imports have no effect and trigger build warnings. Already reported on 2026-06-28. | `SecurityContext.tsx` 134 (`@capacitor/app`) vs static in `BackupContext.tsx`; `Analysis.tsx` 104–105 (`filesystem`, `share`) vs static in `csv.ts` | Use one import style per module (static is simplest; the modules are small) | None | **New:** ARCHITECTURE A13 |
| P3-6 | P3 | **File names that break AGENTS §4.** | `lib/backupHash.ts`, `lib/googleAuth.ts`, `lib/googleDrive.ts` (should be kebab-case); `pages/not-found.tsx` (should be PascalCase) | Rename only when the file is next changed for another reason (AGENTS §3.2) | None | **New:** ARCHITECTURE A14 |
| P3-7 | P2 | **`FinanceContext` mixes state, rules, and persistence.** 961 lines. | [FinanceContext.tsx](../../artifacts/financial-clarity/src/context/FinanceContext.tsx) | Move rules to `lib/domain/` and persistence to `lib/storage/`; keep the public hook API. Pair with P3-2 and P4-1 | None | ARCHITECTURE A10 (its "about 1,400 lines" is stale) |

## Phase 4 — Reliability and privacy debt

These are fixes, not dead-code removal. Several change behavior and need tests first.

| ID | Sev | Finding | Evidence | Proposed approach | Decision needed | Tracked as |
|---|---|---|---|---|---|---|
| P4-1 | **P1** | **Storage write failures are swallowed.** If a write fails (for example, storage quota is full), the UI keeps the new state as if it were saved, but it is lost on restart. | `FinanceContext.tsx` 320 (`saveToStorage`), 409 (savings goal); `BackupContext.tsx` 92, 256, 285; `month-end-review.ts` 34; `onboarding.ts` 16 | Persist first, then update state; return typed results; show a visible error and keep form values (ARCHITECTURE §6.2, DESIGN §7). Test: "storage failure leaves state unchanged" (AGENTS §11) | None; already a documented target | ARCHITECTURE A2 |
| P4-2 | P2 | **Drive errors log the request URL and the raw response body.** ARCHITECTURE §14.4 allows only error codes and operation names. | [googleDrive.ts](../../artifacts/financial-clarity/src/lib/googleDrive.ts) 56 | Log method, HTTP status, and Drive `reason` only | None | **New:** ARCHITECTURE A15 |
| P4-3 | P2 | **Fonts load from Google at runtime.** This adds a third-party network call on every launch, fails offline, and Inter 700 is used but not loaded. | [index.css](../../artifacts/financial-clarity/src/index.css) line 1 | Bundle Manrope and Inter files in `public/`; drop the remote `@import` | Font licence check (both are OFL) | ARCHITECTURE A5; DESIGN G7 |
| P4-4 | P3 | **Unused Crashlytics helpers.** `reportHandledError` and `setCrashlyticsUserId` have no callers. | [crashlytics.ts](../../artifacts/financial-clarity/src/lib/crashlytics.ts) 76, 88 | Remove, or wire up with scrubbing. DATABASE §9 forbids using the Google profile as a user ID | Depends on the pending D9 privacy review | ARCHITECTURE A9 |
| P4-5 | P2 | **Single 1.2 MB JS chunk.** Slower startup on low-end Android devices. | Build output: `index-*.js` 1,207.57 kB | Lazy-load heavy routes (Analysis with Recharts, month-end flow); measure on a reference device | Reference devices and timing thresholds are still pending (PRD §14) | **New:** ARCHITECTURE A16 |
| P4-6 | P2 | **Analysis share failure is only logged**, not shown to the user. | `Analysis.tsx` (`console.error('Share failed', …)`) | Show a visible error toast (DESIGN §13.7) | None | DESIGN G16 |

## Stale documentation (fix with the related change, or as a docs-only pass)

| ID | Sev | Finding | Where |
|---|---|---|---|
| D-1 | P2 | Gap tables still say SMS code is present. The code is removed in the working tree; checking the merged release manifest for SMS permissions is still outstanding (testing.md SMS-001). | ARCHITECTURE §19 A1; DESIGN §15 G14 |
| D-2 | P3 | A10 says `FinanceContext` is "about 1,400 lines"; it is 961. | ARCHITECTURE §19 A10 |
| D-3 | P2 | The home-PC build guide still mentions `READ_SMS` and links to the removed SMS parser. | [BUILD_ON_HOME_PC.md](../BUILD_ON_HOME_PC.md) |
| D-4 | P3 | Several pages still link to the retired App Oracle / App Auditor agent files and describe them as the only writers. AGENTS.md §1.1 and §12 retired these personas. | [knowledge-base/README.md](../knowledge-base/README.md), [knowledge-base/glossary.md](../knowledge-base/glossary.md), [audits/README.md](./README.md) |

## Suggested order

1. **P4-1** (persist-first writes) together with **P3-2** (key catalogue): both touch the storage boundary, and P4-1 is the main data-loss risk.
2. **P3-3** (shared selectors), once the Transactions-total question is answered.
3. **P3-4**, **P4-2**, **P4-6**: small, contained fixes.
4. **P3-1** (one formatter), after confirming the display change.
5. **P4-3** (bundled fonts) and **P4-5** (code splitting), measured on a device.
6. **P3-5**, **P3-6**, **P3-7**, **P4-4**: opportunistic, or after the D9 decision.

## Decisions needed from the owner

1. Approve any of the items above for implementation (AGENTS §1.3).
2. P3-3: should the Transactions screen total show consumption spend or a raw list total?
3. P3-1: confirm the compact lakh/crore format (`₹1.50 L`) for every screen.
4. P4-4: outcome of the D9 privacy and diagnostics review.

## Gaps

- No manual walkthrough or on-device testing was done. P3-3 is confirmed from code; how
  large the difference is on screen was not measured.
- P4-5 has no device timing data; reference devices are not yet chosen (PRD §14).
- Line numbers are as of this report and will drift as the code changes.
