---
id: decision-0009
title: ADR-0009 — ESLint and axe accessibility checks as development tooling
date: 2026-11-13
updated: 2026-11-13
status: accepted
scope: [financial-clarity, tooling, testing]
related:
  - ../bugs/20261112-mobile-layout-overflow.md
source-of-truth-files:
  - artifacts/financial-clarity/eslint.config.js
  - artifacts/financial-clarity/package.json
  - artifacts/financial-clarity/e2e/accessibility.pw.ts
---

# ADR-0009 — ESLint and axe accessibility checks as development tooling

## Context
The UI polish work (2026-11-13) was asked to run lint and an automated accessibility check. The repository had no lint step (only Prettier) and no accessibility scanner. AGENTS.md §6 requires owner approval and a written reason for new packages.

## Decision
The owner approved these **development-only** packages (none ship in the app bundle):

| Package | What it does | Why existing tools were not enough |
|---|---|---|
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals` | `pnpm --filter @workspace/financial-clarity run lint`: recommended JS/TS rules, classic React hook rules, unused code | TypeScript does not catch unused variables, hook misuse, or constant conditions; Prettier only formats |
| `@axe-core/playwright` | WCAG 2.1 AA scans inside the existing Playwright e2e suite (`e2e/accessibility.pw.ts`) | No automated contrast/ARIA check existed; reuses the Playwright browser already installed |

All are maintained by their upstream projects (ESLint, typescript-eslint, React, Deque) and were installed under the 24-hour `minimumReleaseAge` policy.

## Alternatives considered
- **Lighthouse:** rejected. It is a large dependency, and its accessibility score uses axe-core under the hood. axe in Playwright covers the same rules on overlays and locked states, which Lighthouse page loads cannot reach.
- **React Compiler ESLint rules (`react-hooks` recommended in v7):** not adopted. They would flag existing patterns unrelated to this work; only `rules-of-hooks` and `exhaustive-deps` are on.
- **UI component libraries (Material, Chakra, Mantine):** rejected. They duplicate the existing Radix + Tailwind primitives, add runtime weight, and conflict with DESIGN §1 "calm ledger" and the token system.

## Consequences
- Positive: lint runs with 0 errors. The 7 remaining warnings are in context logic and are left untouched to avoid behavior changes. Accessibility regressions on onboarding, Dashboard, the entry sheet, month-end review, and the lock screen fail e2e.
- Negative: more dev dependencies to keep updated.
- Follow-ups: add `lint` to CI next to typecheck; resolve the 7 warnings in a logic-focused change.

## Supersedes / superseded by
None.
