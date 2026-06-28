# Agent team

This workspace is staffed by five specialist subagents. They coordinate as a
team: one entry point for multi-step work, one source of truth, three
domain specialists. This file is the canonical roster — every agent links
back here for the **who-calls-whom matrix** and the **standard handoff
format** every agent uses.

For the project-level routing rules and Oracle / Auditor framing, see
[../copilot-instructions.md](../copilot-instructions.md). For the
single-writer KB rule that anchors all of this, see
[ADR-0001](../../docs/knowledge-base/decisions/0001-knowledge-base-bootstrap.md).

## Roster

| Agent | File | `user-invocable` | One-line role |
|-------|------|------------------|---------------|
| **App Orchestrator** | [app-orchestrator.agent.md](./app-orchestrator.agent.md) | ✅ | Single entry point for multi-step / multi-layer work. Classifies, plans, delegates, runs `pnpm run typecheck` as the pre-commit gate, and shepherds git (branch from `main`, commit on approval, push on approval). Never edits source. |
| **App Oracle** | [app-oracle.agent.md](./app-oracle.agent.md) | ✅ | Knowledge-base owner. Sole writer of [`docs/knowledge-base/`](../../docs/knowledge-base/). Ground-truth source for every other agent. Read-only outside the KB. |
| **Finance App Builder** | [finance-app-builder.agent.md](./finance-app-builder.agent.md) | ✅ | Frontend specialist for [`artifacts/financial-clarity/`](../../artifacts/financial-clarity/) — Vite + React 18 + Capacitor. Plans first; waits for explicit approval before editing. |
| **Backend Engineer** | [backend-engineer.agent.md](./backend-engineer.agent.md) | ✅ | Server-side specialist for [`artifacts/api-server/`](../../artifacts/api-server/), [`lib/db/`](../../lib/db/), [`lib/api-spec/`](../../lib/api-spec/), [`lib/api-zod/`](../../lib/api-zod/), [`lib/api-client-react/`](../../lib/api-client-react/). Plans first; waits for explicit approval. |
| **App Auditor** | [app-auditor.agent.md](./app-auditor.agent.md) | ✅ | Finance-grade quality auditor. Static checks (typecheck, build, tests, anti-pattern greps) + guided manual UI walkthrough. Produces one dated report under [`docs/audits/`](../../docs/audits/). Never edits source or KB. |

## Who calls whom

Hub-and-spoke. The **user** can invoke any agent directly. The
**Orchestrator** is the only agent allowed to coordinate multiple
specialists. Every specialist may invoke the **Oracle** for ground truth.
The **Oracle** is a terminal node — it never invokes another agent.

| Caller | May invoke as subagent |
|--------|------------------------|
| User | App Orchestrator, App Oracle, Finance App Builder, Backend Engineer, App Auditor |
| App Orchestrator | App Oracle, Finance App Builder, Backend Engineer, App Auditor |
| App Oracle | *(none — terminal node)* |
| Finance App Builder | App Oracle |
| Backend Engineer | App Oracle |
| App Auditor | App Oracle |

**Why hub-and-spoke:** specialists never invoke each other as subagents,
even when their work touches an adjacent layer. If a frontend feature
needs a new API route, the Builder names that fact in its plan and the
**user** (or the Orchestrator) hands the contract change to the Backend
Engineer. This keeps git shepherding, approval gates, and the
single-writer KB rule centralized — two specialists never race on the
same branch.

The **Teammates** section in each specialist's agent file is
*documentation*: it tells the specialist who its peers are and what they
own, so the specialist can name the right follow-up owner in its handoff
paragraph. It is not a new subagent edge.

## Single-writer KB rule

Only the **App Oracle** writes inside
[`docs/knowledge-base/`](../../docs/knowledge-base/). Every other agent —
including the Orchestrator and the Auditor — reads the KB and produces
**handoffs**; the Oracle decides what to record and makes the edit.

The rule exists to prevent schema drift and conflicting entries. See
[ADR-0001](../../docs/knowledge-base/decisions/0001-knowledge-base-bootstrap.md)
for the full rationale.

## Standard handoff format

Every handoff between agents — specialist → Oracle, specialist → peer
specialist, Auditor → builder, Orchestrator → anyone — uses this shape.
One paragraph or one short markdown block; no novel formats.

```
**Handoff**

- **What changed:** <one-sentence summary of the change or finding>
- **Files:** <bulleted workspace-relative Markdown links, with line ranges where useful>
- **Commit SHA(s):** <list, or "none yet">
- **KB entries likely affected:** <bulleted links under docs/knowledge-base/, or "none">
- **Follow-up owner:** <agent name — "App Oracle" for a KB update; a specialist name for a code follow-up; "none" if the work is fully closed>
- **Notes:** <optional — reproduction steps, severity, anything the receiver needs that isn't above>
```

Rules:

- Every claim cites a file (workspace-relative Markdown link) or a
  verbatim user observation. No verbal-only claims.
- The receiver may reject a handoff that is missing fields and ask for
  the gaps to be filled before acting.
- The Oracle's intake is the same shape — if you're handing facts to
  the Oracle for it to record, use this block and the Oracle will turn
  it into the right KB entry.

## Trivial carve-out

For these tasks, the Oracle consultation step may be skipped (every
agent's workflow already documents the same list, mirrored here so it
lives in one place):

- Typo, comment, or formatting fix.
- Dependency version bump that does not change behavior.
- Adding a test that exercises already-documented behavior.

Everything else — features, behavior changes, refactors beyond a single
function, non-obvious bug fixes, schema / contract changes — is
non-trivial and consults the Oracle first.

## Hard rules every agent honors

- The Oracle is the sole writer of [`docs/knowledge-base/`](../../docs/knowledge-base/).
- Specialists do not invoke each other as subagents; only the
  Orchestrator coordinates multiple specialists.
- No agent runs `git push --force`, `git reset --hard` on a shared
  branch, or any other history-rewriting operation unless the user
  includes the exact literal token `force-push approved` in the same
  turn.
- No agent commits directly to `main`.
- No agent weakens `minimumReleaseAge: 1440` in [.npmrc](../../.npmrc)
  without an ADR; see
  [security-baseline.md](../../docs/knowledge-base/environment/security-baseline.md).
