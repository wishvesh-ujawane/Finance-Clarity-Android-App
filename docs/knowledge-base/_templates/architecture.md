---
id: architecture-<slug>
title: <Package or module name>
date: YYYY-MM-DD
updated: YYYY-MM-DD
status: current
scope: [<package-name>]
related: []
source-of-truth-files:
  - <relative/path/to/entry-file>
---

# <Package or module name>

## Purpose
One paragraph: what this package or module exists to do, and why it is
separate from its neighbours.

## Entry points
List the files an agent should read first to understand the module.

## Public surface
Exported APIs, types, or routes other parts of the workspace depend on.

## Internal layout
Short tour of subdirectories and the role of each.

## Dependencies
- Upstream packages it consumes.
- Downstream packages that consume it.

## Known gotchas
Anything subtle that has bitten contributors. Link to the relevant
[bugs/](../bugs/) entry if one exists.
