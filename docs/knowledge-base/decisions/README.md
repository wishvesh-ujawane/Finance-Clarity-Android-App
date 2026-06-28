# Decisions (ADRs)

Architecture Decision Records — numbered, immutable. The "why".

Use [`../_templates/decision.md`](../_templates/decision.md) for new ADRs.

File naming: `NNNN-<short-slug>.md`, zero-padded, monotonic.

Rules:
- ADRs are **not edited in place** after acceptance.
- To revise an accepted decision, create a new ADR and set the old one's
  `status: superseded` with a `superseded by` link.

## Index

- [0001-knowledge-base-bootstrap.md](./0001-knowledge-base-bootstrap.md) — Introduce the App Oracle subagent and the committed knowledge base.
