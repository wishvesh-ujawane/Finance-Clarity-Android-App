---
id: decision-0001
title: ADR-0001 — Bootstrap the knowledge base and the App Oracle subagent
date: 2026-06-28
updated: 2026-06-28
status: accepted
scope: [workspace]
related:
  - ../README.md
  - ../../../.github/agents/app-oracle.agent.md
  - ../../../.github/copilot-instructions.md
source-of-truth-files:
  - .github/agents/app-oracle.agent.md
  - .github/copilot-instructions.md
  - docs/knowledge-base/README.md
---

# ADR-0001 — Bootstrap the knowledge base and the App Oracle subagent

## Context
Project knowledge was scattered: `replit.md`, ad-hoc comments, code archaeology
on demand. Each new agent or contributor re-derived the same facts (FAB has no
per-screen colour, Analysis swipe thresholds, surplus bar uses hardcoded blue,
etc.), often inconsistently. There was no single place to record requirements
as they arrived, no log of bug fixes that explained *why* a change was made,
and no enforcement that decisions be revisited rather than silently reverted.

The user explicitly asked for an agent that "touches every corner of the
application, documents every detail … all other agents will follow this agent
at first and make decisions later."

## Decision
1. Establish a committed knowledge base at
   [`docs/knowledge-base/`](../README.md) with eight categories: architecture,
   features, requirements, bugs, decisions (this folder), environment, api,
   and glossary.
2. Introduce a custom subagent — the **App Oracle** —
   ([.github/agents/app-oracle.agent.md](../../../.github/agents/app-oracle.agent.md))
   as the **sole writer** of that folder. The Oracle is invocable from the
   agent picker and discoverable as a subagent by other agents.
3. Add a workspace `copilot-instructions.md`
   ([.github/copilot-instructions.md](../../../.github/copilot-instructions.md))
   directing every other agent to consult the Oracle **before** any
   non-trivial work and to hand off post-implementation summaries back to it.
4. Define a fixed entry schema (frontmatter with `id`, `title`, `date`,
   `updated`, `status`, `scope`, `related`, `source-of-truth-files`) and a
   matching template per category under [`_templates/`](../_templates/).
5. Record every material change to the knowledge base as one line in
   [`CHANGELOG.md`](../CHANGELOG.md).

## Alternatives considered
- **Repo memory only** (`/memories/repo/`). Rejected: not version-controlled,
  not shared with teammates, and not visible to teammates who do not use
  Copilot.
- **Free-form `docs/` folder with no schema or ownership.** Rejected: prior
  experience shows such folders rot quickly and produce conflicting entries.
- **Description-based subagent discovery only**, with no `copilot-instructions`
  rule. Rejected for now: the user explicitly wants every other agent to
  consult the Oracle first; a description-driven trigger is too easy for the
  model to skip. We can relax this later if latency proves painful.
- **Allow any agent to write the knowledge base** under documented schema
  rules. Rejected: schema drift and conflicting entries are exactly the
  failure mode we are trying to prevent.

## Consequences
**Positive**
- One canonical, citation-backed answer for every "how does X work / why was X
  built this way" question.
- Visible audit trail via git history on `docs/knowledge-base/` plus
  `CHANGELOG.md`.
- New agents and contributors have a single entry point.

**Negative**
- Slight latency cost on every non-trivial request (Oracle round-trip). The
  "trivial vs non-trivial" gate in
  [.github/copilot-instructions.md](../../../.github/copilot-instructions.md)
  is the lever we will tune if the overhead bites.
- The Oracle is a soft single-writer: nothing physically prevents another agent
  from editing files under `docs/knowledge-base/`. Enforcement is by
  convention plus PR review. A `PreToolUse` hook to refuse non-Oracle writes
  is a natural future extension.
- Initial seeding is fixed-cost; subsequent maintenance is the price of having
  a useful knowledge base.

**Follow-ups (not blocking)**
- Add a `PostToolUse` hook that flags edited source files against
  `source-of-truth-files` entries and warns the Oracle of stale candidates.
- Consider a CI check that fails when `docs/knowledge-base/` is touched by a
  non-Oracle agent (e.g. detected via commit trailer or CODEOWNERS).
- Add `lib/integrations/*` packages to the architecture index when any are
  added (the workspace glob already includes them).

## Supersedes / superseded by
- Supersedes: none.
- Superseded by: none.
