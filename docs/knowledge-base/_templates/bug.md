---
id: bug-<YYYYMMDD>-<slug>
title: <One-line bug summary>
date: YYYY-MM-DD            # date observed
updated: YYYY-MM-DD
status: open | investigating | fixed | wontfix | regression
scope: [<affected-features-or-packages>]
related: []
source-of-truth-files:
  - <files-touched-by-fix>
---

# <One-line bug summary>

## Symptom
What the user saw. Reproduction steps, smallest case.

## Root cause
Once known: the actual defect, not just the symptom.

## Fix
What was changed and where. Link to the commit / PR.

## Tests
Tests added or updated to prevent regression. Link to the test files.

## Lessons
What we learned. Patterns to avoid. If this surfaces a missing convention,
file an [ADR](../decisions/).
