# Project Guidelines

## Agent team

This workspace is staffed by five specialist subagents that work as a team.
See [.github/agents/README.md](./agents/README.md) for the full roster, the
who-calls-whom matrix, and the standard handoff format every agent uses.

| Agent | File | Role in one line |
|-------|------|------------------|
| **App Orchestrator** | [agents/app-orchestrator.agent.md](./agents/app-orchestrator.agent.md) | Single entry point for multi-step / multi-layer work; classifies, plans, delegates, and shepherds git. Never edits source. |
| **App Oracle** | [agents/app-oracle.agent.md](./agents/app-oracle.agent.md) | Knowledge-base owner; sole writer of [`docs/knowledge-base/`](../docs/knowledge-base/) and ground-truth source for everyone else. |
| **Finance App Builder** | [agents/finance-app-builder.agent.md](./agents/finance-app-builder.agent.md) | Frontend specialist for [`artifacts/financial-clarity/`](../artifacts/financial-clarity/) (Vite + React 18 + Capacitor). |
| **Backend Engineer** | [agents/backend-engineer.agent.md](./agents/backend-engineer.agent.md) | Server-side specialist for [`artifacts/api-server/`](../artifacts/api-server/), [`lib/db/`](../lib/db/), [`lib/api-spec/`](../lib/api-spec/), [`lib/api-zod/`](../lib/api-zod/), [`lib/api-client-react/`](../lib/api-client-react/). |
| **App Auditor** | [agents/app-auditor.agent.md](./agents/app-auditor.agent.md) | Finance-grade quality auditor; pairs static checks with a guided manual walkthrough. Never edits source or the KB. |

### Routing rules

Pick the agent that matches the work:

- **Multi-step / multi-layer / needs a branch and commit** → **App Orchestrator**.
  Spans frontend + backend, ships a feature end-to-end, or needs git
  shepherding (branch from `main`, commit on approval, push on approval).
- **Single-domain implementation** → call the specialist directly.
  Frontend-only feature or polish → **Finance App Builder**. Server-only
  schema / route / contract work → **Backend Engineer**.
- **Ground-truth question** ("how does X work", "why was X built", "is this
  intentional") → **App Oracle**.
- **Quality sweep** (find bugs, regression hunt, money-math / sync /
  accessibility audit) → **App Auditor**.
- **Trivial** (typo, comment, formatting, behavior-preserving version bump,
  test for already-documented behavior) → default Copilot agent or the
  responsible specialist; the Oracle consultation may be skipped.

**Hub-and-spoke rule:** Specialists do **not** invoke each other as
subagents — only the **Orchestrator** coordinates multiple specialists, and
every specialist may invoke the **Oracle**. This keeps git shepherding and
approval gates centralized; see
[agents/README.md](./agents/README.md#who-calls-whom).

**Clickable artifacts for every prompt:** Every agent presents its
questions to the user as clickable options via the
`vscode_askQuestions` tool — approval gates, mid-plan clarifications,
plan-revision feedback, dev-server start, per-feature checklist
intake. Typed approval tokens (`yes`, `approved`, `go`, `proceed`,
`ship it`) remain a documented fallback; `force-push approved` is the
one safety token that must always be typed. See
[agents/README.md](./agents/README.md#asking-the-user--clickable-artifacts).

## Consult the App Oracle first

This workspace has a dedicated knowledge-keeper subagent — the **App Oracle**
— that owns [`docs/knowledge-base/`](../docs/knowledge-base/) as the canonical
record of every architectural choice, feature behavior, bug fix, requirement,
and decision in the project.

**Before any non-trivial work, invoke the `app-oracle` subagent first** to
retrieve ground truth for the area you are about to touch, then proceed with
its answer in hand.

Non-trivial work includes:
- Implementing a new feature or capability.
- Changing the behavior of an existing feature or component.
- Refactoring anything beyond a single function.
- Fixing a bug whose root cause is not immediately obvious.
- Answering a user question about how the app works, why something is built
  the way it is, or whether a behavior is intentional.
- Adding or modifying a public API, schema, or contract.

Trivial work that **does not** require consulting the Oracle:
- Typo, comment, or formatting fixes.
- Dependency version bumps that do not change behavior.
- Adding tests that exercise already-documented behavior.

After completing non-trivial work, hand a one-paragraph diff summary back to
the Oracle so it can update the relevant knowledge-base entries.

## Single-writer rule for the knowledge base

**Only the App Oracle writes inside [`docs/knowledge-base/`](../docs/knowledge-base/).**
Do not create, modify, or delete files in that folder directly. If you have
something to record, hand it off to the Oracle and let it make the edit. This
rule exists to prevent schema drift and conflicting entries; see
[ADR-0001](../docs/knowledge-base/decisions/0001-knowledge-base-bootstrap.md).

## App Auditor for quality sweeps

For finance-grade audits — money math errors, value drift across screens,
UI/UX glitches, crashes, perf regressions, security or accessibility gaps,
and "does this still match the documented behavior" sweeps — invoke the
**App Auditor** subagent at
[`.github/agents/app-auditor.agent.md`](./agents/app-auditor.agent.md).

The auditor runs static checks (typecheck, build, tests, anti-pattern greps),
optionally starts the dev server in a background terminal, and hands **you**
per-feature click-through checklists to follow manually in the browser. It
intakes your observations, categorizes every finding as **P0 / P1 / P2 / P3**,
writes one dated report under [`docs/audits/`](../docs/audits/), and hands
P0/P1 bugs to the App Oracle for KB entry. It never edits source or KB
files and never drives a browser itself.

## App Orchestrator for end-to-end work

For any task that needs more than one specialist — a feature that spans
backend and frontend, a bug fix that should land on its own branch, a
refactor that needs KB updates after the code change — invoke the
**App Orchestrator** subagent at
[`.github/agents/app-orchestrator.agent.md`](./agents/app-orchestrator.agent.md).

The orchestrator classifies the request (`feature` / `bug` / `refactor` /
`audit` / `docs-only` / `trivial`), consults the App Oracle for ground
truth, plans the work, delegates to the right specialist(s) in dependency
order (DB → backend → frontend), runs `pnpm run typecheck` as the pre-commit
gate, and shepherds the result through git: branches from `main` as
`feature/<slug>` or `fix/<slug>`, stages changes automatically, and
**always asks before committing and before pushing**. It enforces
Conventional Commits, refuses to commit on `main`, and never runs
`git push --force` (or any other history-rewriting command) unless you
include the exact token `force-push approved` in the same turn. It never
edits source files itself and never opens pull requests.

## Workspace facts at a glance

- **Monorepo**: pnpm workspaces; packages under `artifacts/*`, `lib/*`, `lib/integrations/*`.
- **Top-level commands**: `pnpm run typecheck`, `pnpm run build`. See
  [environment/build-and-test.md](../docs/knowledge-base/environment/build-and-test.md).
- **Supply-chain policy**: `minimumReleaseAge: 1440` in [.npmrc](../.npmrc) — do
  not weaken without an ADR. See
  [environment/security-baseline.md](../docs/knowledge-base/environment/security-baseline.md).

For everything else, ask the Oracle.

## Feature backlog — consult before proposing new work

Whenever the user asks an open-ended build question — *"what should I build
next?"*, *"what to build?"*, *"what feature next?"*, *"any ideas?"*, or
similar — first read the current backlog at
[docs/knowledge-base/requirements/20260705-feature-backlog.md](../docs/knowledge-base/requirements/20260705-feature-backlog.md)
and pull **2–4 suggestions from it** into your reply, tagged by their
backlog id (e.g. **2.1**, **2.7**, **5.1**).

Guidelines:

- Prefer ideas whose `Status` is still `idea` (not `accepted`, `rejected`,
  or `superseded`).
- Bias toward the file's **Top-5 recommendation** unless the user's context
  points elsewhere (a screen they're editing, a bug they just filed, a
  theme they mentioned).
- Include effort tag (S / M / L) and one-line rationale for each pick.
- You may also add fresh ideas *in addition to* the backlog picks — call
  them out as "new" so the user can decide whether to file them into the
  backlog.
- After the user picks one, follow the normal plan-and-wait cycle. On
  approval, graduate the picked idea from a backlog row to its own
  `requirement-<date>-<slug>.md` entry with acceptance criteria, and mark
  its row in the backlog as `accepted → see <link>`.

