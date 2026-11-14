# Knowledge Base

The canonical, single-source-of-truth record of this workspace. Every architectural
choice, feature behavior, requirement change, bug fix, and decision lives here.

This knowledge base is maintained by the coding agent under
[AGENTS.md](../../AGENTS.md) §12. The former App Oracle subagent is retired.
It adds detail to the core documents (AGENTS.md §1.1) but never overrides them.
For a short summary of the current state, read [PROGRESS.md](../PROGRESS.md) first.

## Read protocol

Before answering questions about, modifying, or extending any part of this workspace:

1. Read the entries for the area you are about to touch, and check them
   against the code in their `source-of-truth-files`.
2. If an entry disagrees with the code or a core document, report the gap;
   do not resolve it silently (AGENTS.md §1.3).
3. When you finish a change that alters documented behavior, update the
   relevant entries in the same change and append a
   [`CHANGELOG.md`](./CHANGELOG.md) line.

## Write protocol

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
| [CHANGELOG.md](./CHANGELOG.md) | Append-only feed of every knowledge-base update. |
| [_templates/](./_templates/) | Entry templates for new pages. |

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

Knowledge-base updates are required for **non-trivial** work. Trivial work
that does **not** need a knowledge-base update:

- typo or comment-only fixes
- formatting / lint-only changes
- dependency version bumps that do not change behavior
- adding tests that exercise already-documented behavior

Everything else — new features, refactors, behavior changes, bug fixes,
requirement clarifications, "how does X work?" questions — is non-trivial.
