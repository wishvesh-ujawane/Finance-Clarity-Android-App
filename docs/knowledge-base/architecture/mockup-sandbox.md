---
id: architecture-mockup-sandbox
title: Mockup sandbox (`@workspace/mockup-sandbox`)
date: 2026-06-28
updated: 2026-11-06
status: deprecated
scope: [mockup-sandbox]
related:
  - ./financial-clarity.md
source-of-truth-files:
  - artifacts/mockup-sandbox/package.json
  - artifacts/mockup-sandbox/vite.config.ts
  - artifacts/mockup-sandbox/mockupPreviewPlugin.ts
  - artifacts/mockup-sandbox/src/App.tsx
---

# Mockup sandbox (`@workspace/mockup-sandbox`)

> **Deprecated 2026-11-06.** This package was deleted from the workspace because the app is local-only (on-device storage, Google Drive backup, CSV import/export) and never used it. Links to its source files below no longer resolve. This entry is kept as a historical record only. See [workspace.md](./workspace.md).

## Purpose
A Vite-based scratch app for previewing UI components and design mock-ups in
isolation, before they are integrated into [financial-clarity](./financial-clarity.md).

## Entry points
- [src/App.tsx](../../../artifacts/mockup-sandbox/src/App.tsx)
- [mockupPreviewPlugin.ts](../../../artifacts/mockup-sandbox/mockupPreviewPlugin.ts)
  — custom Vite plugin that wires the mock-up previewer.

## Internal layout
- `src/components/` — sandbox components.
- `src/hooks/`, `src/lib/` — small helpers.

## Consumers
None. The sandbox is a developer tool; its output is not shipped.

## Known gotchas
- Components copied into the sandbox can drift from the production versions in
  `artifacts/financial-clarity`. Treat the sandbox as a sketch, not the source
  of truth.
