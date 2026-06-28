---
id: feature-<slug>
title: <Feature or screen name>
date: YYYY-MM-DD
updated: YYYY-MM-DD
status: current
scope: [<artifact-name>]
related: []
source-of-truth-files:
  - <relative/path/to/page-or-component>
---

# <Feature or screen name>

## User-visible behavior
What the user sees and can do. Describe the screen top-to-bottom.

## Trigger / entry points
How the user reaches this feature (route, navigation item, deep link, FAB action).

## State & data sources
Which context, hook, or storage provides the data this feature reads and writes.

## Interactions
Per-interaction breakdown: gestures, buttons, sheets, dialogs. Cite the line
ranges in the source-of-truth files where each interaction is implemented.

## Edge cases & empty states
What the feature shows when there is no data, when validation fails, etc.

## Cross-feature dependencies
Other features whose state this one reads (e.g. categories, budgets, security PIN).

## Related changes
Link to [requirements/](../requirements/) entries that shaped this feature and to
[bugs/](../bugs/) entries that were fixed in it.
