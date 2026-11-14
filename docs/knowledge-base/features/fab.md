---
id: feature-fab
title: Floating Action Button (FAB)
date: 2026-06-28
updated: 2026-11-14
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./dashboard.md
  - ./budgets.md
  - ./transactions.md
  - ./recurring-expenses.md
  - ./categories.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/FAB.tsx
  - artifacts/financial-clarity/src/context/FabContext.tsx
  - artifacts/financial-clarity/src/hooks/useDefaultFabMenu.tsx
---

# Floating Action Button (FAB)

## User-visible behavior
A fixed circular button. Position: `bottom-20 right-5` on mobile,
`bottom-8 right-8` on desktop, `z-50`, offset by the bottom safe-area inset.
Default look is `bg-accent` with a white Plus icon; a screen can override the
classes and the icon.

Two modes:

- **Single action** — tapping the button runs the registered action.
- **Speed-dial** — tapping the button fans out labelled mini-buttons above it,
  shows a dimmed backdrop, and turns the icon into a close (X). Tapping an item
  closes the menu and then runs the item. Tapping the backdrop closes the menu.
  The menu closes when the registered action changes (for example on a route
  change).

The button is unmounted when no screen has registered an action, so its enter
animation runs again on screens that register one.

## Registration API
[FabContext.tsx](../../../artifacts/financial-clarity/src/context/FabContext.tsx):

- `useFabAction(onClick, label, testId?, options?)` — register a single
  action for the component's lifetime; cleared on unmount. `options` accepts
  `className`, `icon`, and `menuItems`. `onClick` is held in a ref, so inline
  arrow functions do not re-register the FAB.
- `useFabMenu(items, testId?)` — register a speed-dial. Each item has
  `onClick`, `label`, `icon`, optional `testId`, and optional `className`.
- `useFabContext()` — read the current registration.

[useDefaultFabMenu.tsx](../../../artifacts/financial-clarity/src/hooks/useDefaultFabMenu.tsx)
registers the shared speed-dial: Add expense, Add income, Add budget, and Add
savings.

## Cross-feature usage
- [dashboard.md](./dashboard.md), [transactions.md](./transactions.md), and
  [budgets.md](./budgets.md) — `useDefaultFabMenu()`.
- [recurring-expenses.md](./recurring-expenses.md) — single action that opens
  the Add Recurring form.
- [categories.md](./categories.md) — single action that opens the Add
  Category form.

## Known gotchas
- Keep `menuItems` and `icon` references stable (for example with
  `useMemo`). A new array or element on every render re-registers the FAB and
  can cause a render loop (fixed once in `useDefaultFabMenu`, React error #185).
