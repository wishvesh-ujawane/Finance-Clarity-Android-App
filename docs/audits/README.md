# Audits

This folder holds **point-in-time audit reports** for the Financial
Clarity workspace. It is written exclusively by the **App Auditor**
subagent at [.github/agents/app-auditor.agent.md](../../.github/agents/app-auditor.agent.md).

Audit reports are **not** canonical ground truth — the App Oracle's
knowledge base at [docs/knowledge-base/](../knowledge-base/) is. Each
report is a dated snapshot of what the codebase looked like, what
checks were run, and what the user reported during a manual walkthrough.
Confirmed bugs are handed off to the App Oracle to file under
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

The full report template lives in
[.github/agents/app-auditor.agent.md](../../.github/agents/app-auditor.agent.md)
under the **Report file format** section.

## Index

_No audits run yet. Entries will appear here as reports are filed._
