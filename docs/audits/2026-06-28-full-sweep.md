---
date: 2026-06-28
scope: "full sweep"
auditor: app-auditor
status: complete
oracle-consulted: true
manual-walkthrough: skipped-by-user
dev-server: started-by-auditor
features-covered: []
---

# Audit — Full sweep (static evidence only)

## Summary

Counts by severity: **P0=0, P1=3, P2=2, P3=4**. The codebase passes
`pnpm run typecheck` and `pnpm run build` cleanly; no money-math, data-loss,
crash, security, or auth defects surfaced from static analysis. Three P1s
are concentrated in build/perf and documentation-of-truth: a 1.17 MB initial
chunk, three Capacitor modules whose dynamic-import code-splits are defeated
by colocated static imports, and KB-level documentation that points at the
wrong file for the supply-chain `minimumReleaseAge` setting. The manual
walkthrough was deferred — every feature-level behavior check listed under
**Gaps** is unverified for this run.

## Evidence gathered

- **typecheck**: pass (`pnpm run typecheck` — `tsc -p tsconfig.json --noEmit`
  emitted no output).
- **build**: pass with warnings (`pnpm --filter financial-clarity run build`
  built in 9.23s; 2914 modules transformed). Three Rollup warnings (Capacitor
  dynamic+static dual import) and two sourcemap noise lines (shadcn
  `tooltip.tsx`, `sheet.tsx`). Single emitted chunk
  `dist/public/assets/index-DsfrXIkB.js` = 1,171.00 kB / 342.75 kB gzip,
  crossing Vite's 500 kB warning threshold.
- **tests**: no per-package `test` script in
  [artifacts/financial-clarity/package.json](../../artifacts/financial-clarity/package.json)
  or sibling packages — not run.
- **Oracle consultation**: relied on
  [docs/knowledge-base/architecture/financial-clarity.md](../knowledge-base/architecture/financial-clarity.md)
  (FinanceContext is canonical localStorage writer; other contexts manage
  their own domain keys),
  [docs/knowledge-base/environment/security-baseline.md](../knowledge-base/environment/security-baseline.md)
  (claims `minimumReleaseAge: 1440` lives in `.npmrc`), and the FAB / Analysis
  spring-constant conventions from the architecture KB.

### Static anti-pattern grep results

| # | Pattern | Hits | Notes |
|---|---------|------|-------|
| 1 | Hardcoded INR (regex `currency-digit`) outside `finance-utils.ts` and tests | 0 | Clean — canonical formatter respected. |
| 2 | `.toFixed(2)` in `artifacts/**` | 8 | 2 inside [finance-utils.ts](../../artifacts/financial-clarity/src/lib/finance-utils.ts#L19-L20) (canonical, fine); 4 inside [TrendsPane.tsx](../../artifacts/financial-clarity/src/components/analysis/TrendsPane.tsx#L186-L191) (chart data points, not display); 1 in [Transactions.tsx](../../artifacts/financial-clarity/src/pages/Transactions.tsx#L90) (search haystack); 1 in [BackupRestore.tsx](../../artifacts/financial-clarity/src/pages/BackupRestore.tsx#L18) (dedupe key). See findings P2-2 and P3-2/P3-3. |
| 3 | `Math.round(... * 100)` | 1 | [TransactionSheet.tsx](../../artifacts/financial-clarity/src/components/TransactionSheet.tsx#L31) calculator UI rounding (P3-1). |
| 4 | `localStorage.{get,set,remove}Item` outside `src/context/` and `src/lib/backup*` | 7 unique sites | All confined to dedicated domain modules: [googleAuth.ts](../../artifacts/financial-clarity/src/lib/googleAuth.ts#L39-L61) (auth user cache), [onboarding.ts](../../artifacts/financial-clarity/src/lib/onboarding.ts#L12-L16) (onboarding flags), [security.ts](../../artifacts/financial-clarity/src/lib/security.ts#L50-L103) (PIN / app-lock settings). Each is its own domain — finance state still flows exclusively through `FinanceContext`. No finding. |
| 5 | `dangerouslySetInnerHTML` | 2 | Both inside shadcn chart helpers ([financial-clarity chart.tsx](../../artifacts/financial-clarity/src/components/ui/chart.tsx#L79), [mockup-sandbox chart.tsx](../../artifacts/mockup-sandbox/src/components/ui/chart.tsx#L78)) — CSS-variable injection for chart theming, standard shadcn pattern with no user-controlled HTML. No finding. |
| 6 | `console.{log,warn,error}` in `artifacts/api-server/src/**` | 0 | Clean. |
| 7 | `parseFloat(` / `parseInt(` on currency-shaped inputs | 17 | All on explicit input strings (Budgets / RecurringExpenses / SavingsGoals form fields, CSV import, calculator), with `<= 0` or `Number.isFinite` guards at the call sites. No finding. |
| 8 | `: any` in money files | 0 in [finance-utils.ts](../../artifacts/financial-clarity/src/lib/finance-utils.ts). Clean. |
| 9 | Icon-only `<Button>` without `aria-label` | 0 matches via the documented regex; spot-check of [Categories.tsx](../../artifacts/financial-clarity/src/pages/Categories.tsx#L132), [TransactionSheet.tsx](../../artifacts/financial-clarity/src/components/TransactionSheet.tsx#L245-L272), [FAB.tsx](../../artifacts/financial-clarity/src/components/FAB.tsx#L25) confirms `aria-label` discipline. No finding. |

## User observations

None — manual walkthrough skipped by user (`skip rest`).

## Findings

### P0 — Non-negotiable

None.

### P1 — Moderately affecting

#### P1-1 — Initial JS chunk is 1.17 MB, > 2× Vite's 500 kB warning limit

- **Domain:** Performance.
- **Evidence:**
  - Build output: `dist/public/assets/index-DsfrXIkB.js   1,171.00 kB | gzip: 342.75 kB`
    followed by Rollup `(!) Some chunks are larger than 500 kB after minification.`
  - [vite.config.ts](../../artifacts/financial-clarity/vite.config.ts) has no
    `build.rollupOptions.output.manualChunks` and no raised
    `build.chunkSizeWarningLimit`.
- **Reproduction:** `pnpm --filter financial-clarity run build` from repo root.
- **Impact:** Cold-start on a Capacitor-wrapped Android target ships a
  single ~1.17 MB JS payload before any screen renders. On the mid-range
  Android handsets this app is built for, that materially regresses
  Time-to-Interactive on first launch and post-update; also forces every
  hot-path screen (Dashboard, Budgets) to wait on parsing code it does not
  need at boot (Analysis charts, CSV import, biometric/Drive).
- **Suggested owner:** Finance App Builder.
- **Oracle handoff:** yes.

#### P1-2 — Capacitor dynamic imports defeated by colocated static imports (3 modules)

- **Domain:** Performance.
- **Evidence:** Three Rollup `vite:reporter` warnings during build:
  - `@capacitor/app` — dynamically imported by
    [SecurityContext.tsx](../../artifacts/financial-clarity/src/context/SecurityContext.tsx#L134)
    but statically imported by
    [BackupContext.tsx](../../artifacts/financial-clarity/src/context/BackupContext.tsx#L10).
  - `@capacitor/filesystem` — dynamically imported by
    [Analysis.tsx](../../artifacts/financial-clarity/src/pages/Analysis.tsx#L104)
    but statically imported by
    [csv.ts](../../artifacts/financial-clarity/src/lib/csv.ts#L2).
  - `@capacitor/share` — dynamically imported by
    [Analysis.tsx](../../artifacts/financial-clarity/src/pages/Analysis.tsx#L105)
    but statically imported by
    [csv.ts](../../artifacts/financial-clarity/src/lib/csv.ts#L3).
- **Reproduction:** Same as P1-1.
- **Impact:** The `await import()` calls were written specifically to keep
  share-image (Analysis) and app-state (SecurityContext re-auth) plugins out
  of the initial bundle, but the static imports in `BackupContext` / `csv.ts`
  force them in anyway. Root cause of part of P1-1; fixing P1-1 without
  reconciling these imports will not produce the intended code-split.
- **Suggested owner:** Finance App Builder.
- **Oracle handoff:** yes.

#### P1-3 — KB and copilot-instructions point `minimumReleaseAge` source-of-truth at `.npmrc`, but the setting lives in `pnpm-workspace.yaml`

- **Domain:** Functionality vs. documented behavior (security-baseline doc).
- **Evidence:**
  - Verified actual file: [.npmrc](../../.npmrc) contains only
    `auto-install-peers=false` and `strict-peer-dependencies=false` — no
    `minimumReleaseAge` line.
  - Setting actually lives at
    [pnpm-workspace.yaml](../../pnpm-workspace.yaml) with
    `minimumReleaseAge: 1440` plus `minimumReleaseAgeExclude:` allow-list.
  - KB drift:
    [docs/knowledge-base/environment/security-baseline.md](../knowledge-base/environment/security-baseline.md#L1-L20)
    frontmatter `source-of-truth-files: - .npmrc` and body
    `[.npmrc](../../../.npmrc) pins minimumReleaseAge: 1440`.
  - copilot-instructions drift:
    [.github/copilot-instructions.md](../../.github/copilot-instructions.md#L118)
    line `minimumReleaseAge: 1440 in .npmrc`.
- **Reproduction:** `Get-Content .npmrc` vs `Select-String -Path pnpm-workspace.yaml -Pattern 'minimumReleaseAge'`.
- **Impact:** A reader auditing the supply-chain baseline who looks at
  `.npmrc` (as both the KB and copilot-instructions direct) will find
  nothing and may conclude the protection is missing, then either (a)
  attempt to "fix" it by re-adding the line to `.npmrc`, creating dual
  sources of truth that can diverge silently, or (b) believe the
  workspace is unprotected. The actual `minimumReleaseAge` enforcement
  in `pnpm-workspace.yaml` is intact and working — this is a
  documentation-of-truth defect, not a runtime security regression.
- **Suggested owner:** App Oracle (KB content); the workspace-facts line
  in [.github/copilot-instructions.md](../../.github/copilot-instructions.md#L118)
  is outside the KB and needs the user or App Orchestrator to update it.
- **Oracle handoff:** yes.

### P2 — Low impact

#### P2-1 — Build emits sourcemap noise for two shadcn UI files

- **Domain:** UI / UX glitches (build tooling).
- **Evidence:** Build output:
  - `src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.`
  - `src/components/ui/sheet.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.`
  - Files: [tooltip.tsx](../../artifacts/financial-clarity/src/components/ui/tooltip.tsx),
    [sheet.tsx](../../artifacts/financial-clarity/src/components/ui/sheet.tsx).
- **Reproduction:** `pnpm --filter financial-clarity run build`.
- **Impact:** Both messages are non-fatal but appear with the misleading
  word "Error" in every CI build log and can mask a future *real* sourcemap
  failure on these files. No runtime effect.
- **Suggested owner:** Finance App Builder.
- **Oracle handoff:** no (P2).

#### P2-2 — CSV import dedupe key uses `t.amount.toFixed(2)` on raw float amount

- **Domain:** Money math & currency (edge case).
- **Evidence:** [BackupRestore.tsx](../../artifacts/financial-clarity/src/pages/BackupRestore.tsx#L11-L19)
  `transactionKey()` builds an import-dedupe key from
  `input.amount.toFixed(2)`. Amounts are stored as raw JS numbers
  (`finance-utils.ts` formatters do not use integer-paise), so a
  re-import after a sum/diff operation upstream could produce a
  toFixed(2) string that differs from a stored amount by a banker's-
  rounding cent and look like a new entry rather than a duplicate.
- **Reproduction:** Theoretical; would require crafting a CSV whose
  amount differs from a stored amount by exactly the 2nd-decimal
  banker's-rounding boundary. Not reproduced this run.
- **Impact:** Edge-case duplicate misclassification on import. Low real-
  world likelihood given the app only stores user-entered integers in
  practice.
- **Suggested owner:** Finance App Builder.
- **Oracle handoff:** no (P2).

### P3 — Can ignore

- **P3-1** — `Math.round(value * 100) / 100` in
  [TransactionSheet.tsx](../../artifacts/financial-clarity/src/components/TransactionSheet.tsx#L31)
  `formatAmountResult` is the in-sheet calculator's display rounding, not
  money storage. Cosmetic.
- **P3-2** — `t.amount.toFixed(2)` in
  [Transactions.tsx](../../artifacts/financial-clarity/src/pages/Transactions.tsx#L90)
  is used only as one of several haystack tokens for substring search.
  No display impact.
- **P3-3** — `Number(cumulative.toFixed(2))` and friends in
  [TrendsPane.tsx](../../artifacts/financial-clarity/src/components/analysis/TrendsPane.tsx#L186-L191)
  are chart-point precision, not money display.
- **P3-4** — Hardcoded `[hsl(222,65%,13%)]` on the Budgets surplus bar is
  already documented as a known gotcha in
  [architecture/financial-clarity.md](../knowledge-base/architecture/financial-clarity.md)
  "Known gotchas". No new finding; tracked.

## Domains with no findings

- Money math & currency (display path) — canonical `formatINR` / `formatAmount`
  used everywhere display-facing; all flagged `toFixed(2)` hits are non-display.
- Data sync & consistency across screens — **not statically verifiable**;
  see Gaps.
- State & storage — `FinanceContext` is the sole writer for finance state;
  `BackupContext`, `SecurityContext`, `googleAuth.ts`, `onboarding.ts`, and
  `security.ts` each manage their own domain-scoped keys as documented in
  [architecture/financial-clarity.md](../knowledge-base/architecture/financial-clarity.md).
- UI / UX glitches — no `aria-label` regressions on icon buttons; spring
  constants not assessed dynamically (manual walkthrough skipped).
- Crash / robustness — typecheck clean; no unguarded XSS sinks beyond
  intentional shadcn chart CSS injection.
- Backend / API — out of scope this run (Postgres-backed `api-server` not
  started; user did not request backend coverage and the frontend is
  documented as localStorage-only).
- Security — supply-chain enforcement intact in `pnpm-workspace.yaml` (the
  P1-3 finding is doc drift, not runtime weakening); no secrets in source.
- Accessibility — keyboard / contrast / reduced-motion checks deferred to
  manual walkthrough; see Gaps.

## Handoffs queued

- **App Oracle** (3 P1 findings) — to file bug entries under
  [docs/knowledge-base/bugs/](../knowledge-base/bugs/):
  - P1-1 Bundle size > 500 kB warning (perf).
  - P1-2 Capacitor dynamic-import code-split defeat (perf, root cause of P1-1).
  - P1-3 `minimumReleaseAge` source-of-truth doc drift (security-baseline
    KB content; Oracle owns the KB edit, copilot-instructions edit is
    outside KB and needs separate user/Orchestrator action).
- **Finance App Builder** (suggested fix owner) — P1-1, P1-2, P2-1, P2-2.
- **Backend Engineer** — none.

## Gaps

The manual walkthrough was skipped by user request (`skip rest`). The
following per-feature checklists from the App Auditor agent definition
were **not executed** this run and remain unverified:

1. **Onboarding** — IntroCarousel slide transitions, dot indicator,
   Get-started + Auth + Restore-choice flow.
2. **Dashboard** — totals vs. seeded transactions, month switching
   recomputation.
3. **Transactions** — add income/expense propagation to Dashboard / Analysis
   / Budgets; delete propagation.
4. **Categories** — create / assign / rename propagation across all surfaces.
5. **Budgets** — color thresholds at <= 50% / 75-100% / > 100%; Transfer-to-
   Next-Month correctness.
6. **Savings goals** — contribution progress bar, on-target color flip.
7. **Recurring expenses** — pause / resume badge, auto-add behavior past
   day-of-month.
8. **Analysis** — Overview -> Planning -> Trends drag-swipe spring
   (320 stiffness / 32 damping per KB), MoM math.
9. **FAB** — per-screen rendering, accent color, sheet/dialog wiring,
   400 stiffness / 20 damping per KB.
10. **Backup / Restore** — export -> wipe -> restore round-trip and hash
    check.
11. **Security** — app-lock / biometric gate cannot be bypassed.
12. **Settings** — toggle persistence across reload.

Out-of-scope (intentional, not a gap):
- Backend / api-server runtime audit — Postgres not requested for this
  run; backend was never started.
- Android native shell — out of App Auditor scope per agent definition.
- Performance numbers under real load — no perf harness available; the
  P1-1 / P1-2 findings are based on static bundle size and Rollup
  warnings only.
