---
id: feature-changelog
title: What's New (release notes)
date: 2026-11-12
updated: 2026-11-12
status: current
scope: [financial-clarity]
related: [feature-settings]
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Changelog.tsx
  - artifacts/financial-clarity/src/lib/changelog.ts
---

# What's New (release notes)

## User-visible behavior
A Settings sub-page titled "What's New". It lists releases newest first. Each card shows the release date, the app version, and 1 to 4 short lines marked **New** or **Fixed**.

## Trigger / entry points
Settings → Support → What's New (`/settings/changelog`).

## State & data sources
Static data in `lib/changelog.ts` (`CHANGELOG_ENTRIES`), bundled with the app. `getChangelog()` drops invalid entries and sorts newest first. Nothing is stored on the device and nothing is fetched.

## Interactions
Back button returns to Settings. The list is read-only.

## Edge cases & empty states
No valid entries → "No updates yet" empty card. No loading or error state because the data is static.

## Cross-feature dependencies
None. Rendered only while unlocked, like every page.

## Related changes
Owner request 2026-11-12. Process rule in AGENTS.md §13.1: every deployment adds an entry.
