---
id: environment-build-and-test
title: Build, test, and tooling commands
date: 2026-06-28
updated: 2026-11-14
status: current
scope: [workspace]
related:
  - ../architecture/workspace.md
  - ./security-baseline.md
  - ../decisions/0009-ui-lint-and-accessibility-tooling.md
source-of-truth-files:
  - package.json
  - pnpm-workspace.yaml
  - artifacts/financial-clarity/package.json
  - artifacts/financial-clarity/eslint.config.js
  - artifacts/financial-clarity/playwright.config.ts
  - .github/workflows/ci.yml
  - scripts/build-debug-apk.ps1
  - scripts/clean-build.ps1
---

# Build, test, and tooling commands

## Summary
The workspace uses pnpm 10 + Node 24 + TypeScript ~5.9. It has one package,
`@workspace/financial-clarity`. The root scripts fan out to its `typecheck`
and `build` scripts.

## Install
```bash
pnpm install
```
The `preinstall` hook in [package.json](../../../package.json) rejects any
non-pnpm install and removes `package-lock.json` / `yarn.lock` if present.

## Top-level commands
```bash
# typecheck the app and its e2e tests
pnpm run typecheck

# typecheck + build
pnpm run build
```

## App commands
```bash
# unit tests (Vitest), single run
pnpm --filter @workspace/financial-clarity run test:run

# unit tests in watch mode / with UI
pnpm --filter @workspace/financial-clarity run test
pnpm --filter @workspace/financial-clarity run test:ui

# end-to-end tests (Playwright, including axe accessibility checks)
pnpm --filter @workspace/financial-clarity run test:e2e

# lint (ESLint)
pnpm --filter @workspace/financial-clarity run lint

# local dev server
pnpm --filter @workspace/financial-clarity run dev
```

## Continuous integration
[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) runs on pull
requests: frozen-lockfile install → typecheck → Vitest → web build. Lint and
Playwright are not part of CI; run them locally.

## Android build scripts
Both scripts switch to the repository root first, so they run from any directory.
```powershell
# web build -> cap sync -> debug APK -> install on a connected device
.\scripts\build-debug-apk.ps1

# clear Gradle caches, reinstall dependencies, rebuild the debug APK
.\scripts\clean-build.ps1
```

## Files involved
- [package.json](../../../package.json) — root scripts.
- [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) — `packages` glob, catalog, supply-chain settings.
- [tsconfig.base.json](../../../tsconfig.base.json) — shared compiler options.
- [scripts/](../../../scripts/) — Android build helpers.

## Gotchas
- See [security-baseline.md](./security-baseline.md) for the
  `minimumReleaseAge` install delay.