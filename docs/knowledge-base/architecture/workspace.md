---
id: architecture-workspace
title: Workspace overview
date: 2026-06-28
updated: 2026-11-06
status: current
scope: [workspace]
related:
  - ../environment/build-and-test.md
  - ../environment/security-baseline.md
source-of-truth-files:
  - pnpm-workspace.yaml
  - package.json
  - tsconfig.base.json
---

# Workspace overview

## Purpose
A pnpm workspace that holds one package: the Fiscal Focus app
(`@workspace/financial-clarity`). The app stores data on the device, backs it
up to the user's Google Drive, and imports and exports CSV. There is no
backend, server database, or API code in the repository.

## Top-level layout
- [AGENTS.md](../../../AGENTS.md) — rules for coding agents. Stays at the root.
- [artifacts/financial-clarity/](../../../artifacts/financial-clarity/) — React + Vite + Capacitor Android app. See [financial-clarity.md](./financial-clarity.md).
- [docs/](../../) — core documents (PRD, DESIGN, ARCHITECTURE, DATABASE), implementation plan, testing notes, build guides, audits, manuals, and this knowledge base.
- [scripts/](../../../scripts/) — Android build helpers (`build-debug-apk.ps1`, `clean-build.ps1`). Plain PowerShell scripts, not a workspace package.

## Workspace declaration
`packages` glob in [pnpm-workspace.yaml](../../../pnpm-workspace.yaml):
```yaml
packages:
  - artifacts/*
```

## Stack
- **Node.js** 24
- **Package manager** pnpm 10.x (enforced via `preinstall` script in [package.json](../../../package.json))
- **TypeScript** ~5.9.2 (root devDependency)
- **Formatter** prettier ^3.8.1

## Top-level commands
See [environment/build-and-test.md](../environment/build-and-test.md). Quick list:
- `pnpm run typecheck` — typecheck every package under `artifacts/`.
- `pnpm run build` — typecheck, then run every package's `build` script.

## TypeScript layout
- [tsconfig.base.json](../../../tsconfig.base.json) — shared compiler options,
  extended by the app's `tsconfig.json`. There is no root project-references file.

## Conventions
- Every package's `name` is `@workspace/<folder-name>`.
- Filter syntax: `pnpm --filter @workspace/<name> run <script>`.
- `preinstall` rejects any non-pnpm install and deletes `package-lock.json` /
  `yarn.lock` if present.

## History
- 2026-11-06: Removed the unused server, database, and API-codegen scaffolds
  (`artifacts/api-server`, `lib/db`, `lib/api-spec`, `lib/api-zod`,
  `lib/api-client-react`), the `artifacts/mockup-sandbox` design tool, the
  empty `@workspace/scripts` package, and all Replit configuration. Their KB
  entries are marked `deprecated`.

## Known gotchas
- The supply-chain setting `minimumReleaseAge: 1440` in
  [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) blocks freshly-published
  packages for 24h. See
  [environment/security-baseline.md](../environment/security-baseline.md).