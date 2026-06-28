# Knowledge Base

The canonical, single-source-of-truth record of this workspace. Every architectural
choice, feature behavior, requirement change, bug fix, and decision lives here.

This knowledge base is **owned by the [App Oracle](../../.github/agents/app-oracle.agent.md) subagent**.

## Read protocol (for every other agent — human or AI)

Before answering questions about, modifying, or extending any part of this workspace:

1. Invoke the `app-oracle` subagent to retrieve the ground truth for the area you
   are about to touch. The Oracle will return citation-backed facts pulled from
   this knowledge base and (when needed) directly from the code.
2. If the Oracle reports a knowledge gap, let it record a new entry **before** you
   write any code. The Oracle is responsible for filing it; you are not.
3. When you finish implementing a change that alters previously-documented
   behavior, hand off the diff summary to the Oracle so it can update the
   relevant entries and append a [`CHANGELOG.md`](./CHANGELOG.md) line.

## Write protocol (Oracle only)

- Only the App Oracle writes inside `docs/knowledge-base/`. No other agent and no
  ad-hoc human commit should add or mutate entries here without going through the
  Oracle's review.
- Every new entry uses the matching template under [`_templates/`](./_templates/).
- Every change (new entry, material update, deprecation) appends a single line to
  [`CHANGELOG.md`](./CHANGELOG.md) in the form:
  `YYYY-MM-DD — <category>/<slug>.md — <one-line summary>`
- Every entry must cite the workspace files it describes using workspace-relative
  Markdown links so the next reader can verify against code.

## Map

| Folder | Contents |
|--------|----------|
| [architecture/](./architecture/) | Technical design — one entry per package or major module. The "how it is built". |
| [features/](./features/) | Functional behavior — one entry per screen or user-facing capability. The "what it does". |
| [requirements/](./requirements/) | Change requests and new requirements as they arrive. The "what was asked for". |
| [bugs/](./bugs/) | Bug history and fixes — one entry per resolved bug. The "what went wrong and how we fixed it". |
| [decisions/](./decisions/) | Architecture Decision Records (ADRs) — numbered, immutable. The "why". |
| [environment/](./environment/) | Build, test, deploy, tooling, and environment facts. |
| [api/](./api/) | External API contracts, OpenAPI spec, generated artifacts. |
| [glossary.md](./glossary.md) | Domain terms used across the workspace. |
| [CHANGELOG.md](./CHANGELOG.md) | Append-only feed of every Oracle update. |
| [_templates/](./_templates/) | Entry templates the Oracle uses to create new pages. |

## Entry frontmatter

Every entry begins with YAML frontmatter:

```yaml
---
id: <category>-<short-slug>
title: <human title>
date: YYYY-MM-DD          # creation date
updated: YYYY-MM-DD       # last material update
status: draft | current | deprecated
scope: [list, of, packages, or, screens]
related: [./other-entry.md]
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Analysis.tsx
---
```

`source-of-truth-files` is the most important field: it lists the workspace
files the entry describes. When any of those files change, the entry is a
candidate for update.

## Trivial vs. non-trivial work

The Oracle is consulted on **non-trivial** work. Trivial work that does **not**
require Oracle consultation:

- typo or comment-only fixes
- formatting / lint-only changes
- dependency version bumps that do not change behavior
- adding tests that exercise already-documented behavior

Everything else — new features, refactors, behavior changes, bug fixes,
requirement clarifications, "how does X work?" questions — is non-trivial.
