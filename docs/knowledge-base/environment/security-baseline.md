---
id: environment-security-baseline
title: Supply-chain hardening (pnpm `minimumReleaseAge`)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [workspace]
related:
  - ./build-and-test.md
source-of-truth-files:
  - .npmrc
---

# Supply-chain hardening (pnpm `minimumReleaseAge`)

## Summary
[.npmrc](../../../.npmrc) pins `minimumReleaseAge: 1440` (24 hours). pnpm will
refuse to install any npm package version published within the last day. This
is the workspace's primary defence against drive-by supply-chain attacks: most
malicious releases are detected and pulled within hours, so a 24h delay
provides a strong safety buffer.

## Files involved
- [.npmrc](../../../.npmrc) — `minimumReleaseAge` and `minimumReleaseAgeExclude`
  allow-list.

## Allow-list
The only currently-allowed exceptions:
- `@replit/*`
- `stripe-replit-sync`

To add a package to the allow-list:
1. Confirm the publisher's security posture warrants it.
2. Add it under `minimumReleaseAgeExclude`.
3. Remove the entry once the 1-day window has passed.

## Gotchas
- **Do not weaken or remove `minimumReleaseAge` without an ADR.** Setting it
  to `0` (or deleting the line) leaves the entire workspace vulnerable.
- A failed install with the message *"package is too new"* is the intended
  behaviour — wait, do not bypass.
