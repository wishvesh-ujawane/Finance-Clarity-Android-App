# Audits

> **Note (2026-11-14):** the App Auditor and App Oracle subagents are
> retired. [AGENTS.md](../../AGENTS.md) is the only agent definition. The
> coding agent writes new audit reports here when the owner asks, and records
> confirmed bugs in [docs/knowledge-base/bugs/](../knowledge-base/bugs/)
> itself (AGENTS.md §12). The process below is kept for reference; read
> "App Auditor" and "App Oracle" as "the coding agent".

This folder holds **point-in-time audit reports** for the Financial
Clarity workspace. It was written exclusively by the **App Auditor**
subagent.

Audit reports are **not** canonical ground truth — the core documents
(AGENTS.md §1.1) and the knowledge base at
[docs/knowledge-base/](../knowledge-base/) are. Each
report is a dated snapshot of what the codebase looked like, what
checks were run, and what the user reported during a manual walkthrough.
Confirmed bugs are filed under
[docs/knowledge-base/bugs/](../knowledge-base/bugs/).

## Who writes here

Only the **App Auditor** creates new files here. Other agents and
contributors should not edit existing audit reports — they are
historical records. If a finding is later resolved, that goes in the
App Oracle's bug entry, not by editing the audit.

## File naming

`YYYY-MM-DD-<kebab-case-descriptive-slug>.md`

The date is the audit run date. The slug describes the scope concretely.

Examples:

- `2026-06-28-budgets-money-math-sweep.md`
- `2026-06-28-full-app-walkthrough.md`
- `2026-06-28-backup-restore-roundtrip-check.md`

If multiple audits run on the same date with the same slug, append
`-2`, `-3`, etc.

## How a manual walkthrough audit works

1. You invoke the App Auditor with a scope:
   `"audit the Budgets screen money math"`,
   `"full app walkthrough"`, etc.
2. The auditor consults the App Oracle for ground truth in the scoped
   area.
3. The auditor runs static checks: `pnpm run typecheck`,
   `pnpm run build` (when scope ≥ package), targeted tests, and
   anti-pattern greps.
4. The auditor asks you once: **start the dev server, attach to a URL
   you already have running, or skip the manual walkthrough?**
5. If you opted in, the auditor posts a **per-feature click-through
   checklist** for each in-scope feature. You drive the browser
   manually, follow the steps, and paste your observations back
   (console errors, value mismatches, glitches, or "all good").
6. The auditor cross-checks your observations against the code, opens
   the suspected source files, and cites line ranges.
7. Every finding (static + user-reported) is categorized per the
   severity rubric below.
8. The auditor writes one report here, then hands every P0/P1 finding
   to the App Oracle for KB bug entry. If the auditor started the dev
   server, it tears down the background terminal before finishing.

The auditor **does not** drive a browser itself. You drive; it guides
and records.

## Severity rubric

Every finding goes in exactly one bucket. When uncertain, the auditor
downgrades and notes the uncertainty in the report's `Gaps` section.

- **P0 — Non-negotiable.** Data loss; money math wrong; crash on a
  common path; security or auth flaw; backup/restore broken;
  regulatory/contract violation; Postgres-required backend fails to
  start when backend is in scope.
- **P1 — Moderately affecting.** Wrong values in non-critical UI; sync
  drift between two views of the same data; perf regression on a hot
  path; accessibility failure; broken non-essential feature.
- **P2 — Low impact.** UI polish; copy errors; minor inconsistencies;
  edge-case-only bugs.
- **P3 — Can ignore.** Cosmetic-only on rarely-seen surfaces;
  theoretical; already mitigated.

## Report frontmatter

Every report opens with this YAML frontmatter:

```yaml
date: YYYY-MM-DD
scope: "<user-supplied scope>"
auditor: app-auditor
status: complete
oracle-consulted: true
manual-walkthrough: complete | skipped-by-user
dev-server: "agent-started:<url>" | "user-supplied:<url>" | "not used"
features-covered: [budgets, dashboard, ...]
```

The full report template lived in the retired App Auditor agent file
(`.github/agents/app-auditor.agent.md`, no longer in the repository); follow
the structure of the most recent report instead.

## Index

- [2026-11-12-phases-implementation-review.md](./2026-11-12-phases-implementation-review.md) — Implementation of plan Phases 1–10: what each phase completed, what is pending and why, and the decision log. All branches it lists are now merged into `main`.
- [2026-11-06-e2e-browser-audit.md](./2026-11-06-e2e-browser-audit.md) — End-to-end browser audit with scripted Playwright exploration, security review, and home-PC APK build path. P0=4, P1=13, P2=4, P3=5. Eight reproductions added as expected failures.
- [2026-11-06-cleanup-phases-3-4-review.md](./2026-11-06-cleanup-phases-3-4-review.md) — Cleanup Phases 3 (duplicate/inconsistent code) and 4 (reliability/privacy debt). P0=0, P1=2, P2=7, P3=4. Most items were later addressed by plan Phases 2–9; ARCHITECTURE A10, A13, A14, and A16 are still open (ARCHITECTURE §19).
- [2026-06-28-full-sweep.md](./2026-06-28-full-sweep.md) — Full static sweep. P0=0, P1=3, P2=2, P3=4.
