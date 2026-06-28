---
id: feature-fab
title: Floating Action Button (FAB)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ../architecture/financial-clarity.md
  - ./dashboard.md
  - ./budgets.md
  - ./recurring-expenses.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/FAB.tsx
  - artifacts/financial-clarity/src/context/FabContext.tsx
---

# Floating Action Button (FAB)

## User-visible behavior
A fixed circular `+` button. Position: `bottom-20 right-5` on mobile,
`bottom-8 right-8` on desktop, `z-50`. Always blue (`bg-accent`), always white
Plus icon — no per-screen colour or icon override.

Framer Motion animation:
```ts
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ type: 'spring', stiffness: 400, damping: 20 }}
whileHover={{ scale: 1.08 }}
whileTap={{ scale: 0.93 }}
```

Hidden entirely when no screen has registered an action.

## Registration API
[FabContext.tsx](../../../artifacts/financial-clarity/src/context/FabContext.tsx):
```ts
interface FabAction {
  onClick: () => void;
  label: string;       // accessibility label
  testId?: string;     // data-testid
}
```
Hooks:
- `useFabContext()` — read the currently registered action.
- `useFabAction(onClick, label, testId?)` — register an action for the
  current component's lifetime. Auto-cleared on unmount.

## Usage pattern
```ts
useFabAction(() => setShowForm(true), 'Add budget', 'fab-add-budget');
```

## Cross-feature usage
- [dashboard.md](./dashboard.md) — opens the
  [TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx).
- [budgets.md](./budgets.md) — opens the Add Budget sheet.
- [recurring-expenses.md](./recurring-expenses.md) — opens the Add Recurring form.
- Other screens may register their own action.

## Known gotchas
- **No per-screen colour or icon override.** Any design that needs a custom
  FAB look must modify [FAB.tsx](../../../artifacts/financial-clarity/src/components/FAB.tsx)
  and broaden the `FabAction` interface.
- The FAB is unmounted when no action is registered, not just hidden — so
  enter / exit animation re-runs on every screen change that toggles
  registration.
