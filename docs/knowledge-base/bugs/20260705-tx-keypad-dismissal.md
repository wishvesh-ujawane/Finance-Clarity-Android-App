---
id: bug-20260705-tx-keypad-dismissal
title: On-screen keypad dismissed when tapping calculator operator keys in Add/Edit Transaction
date: 2026-07-05
updated: 2026-07-05
status: fixed
scope: [financial-clarity]
related:
  - ../features/transactions.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/TransactionSheet.tsx
---

# On-screen keypad dismissed when tapping calculator operator keys

## Symptom
In the Add / Edit Transaction sheet, while the amount input has focus and the
soft keypad is showing on Android WebView / mobile Chrome, tapping any of the
calculator operator buttons (`+`, `-`, `x`, `/`) caused the keypad to
collapse. Users then had to tap the amount input again to continue typing —
which broke the common "type a number, tap `+`, type another number" flow
for things like `250+75`.

Reproduction: open the transaction sheet on Android, tap the amount field,
type `250`, tap `+`. Keypad hides.

## Root cause
The five calculator buttons in
[`TransactionSheet.tsx`](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx)
were plain `<button type="button">` elements. In browsers, pointer/mouse/touch
`down` on a focusable button moves DOM focus off the input, and the OS uses
loss of input focus as the signal to dismiss the soft keypad. `type="button"`
alone does not suppress this focus transfer.

## Fix
Added `onPointerDown`, `onMouseDown`, and `onTouchStart` handlers to each
calculator button that call `event.preventDefault()`. This blocks the button
from becoming the focus target before the click fires, so the amount input
keeps focus and the soft keypad stays open. The `onClick` handler still runs
normally and updates the expression via `handleCalculatorKey`.

## Tests
Manual regression: on Android WebView (and Chrome mobile emulation), tap
each of `+`, `-`, `x`, `/`, `=` while the amount input has focus — the
keypad must remain visible for the operator keys, and `=` may commit the
expression without dismissing.

## Lessons
Any tappable control rendered next to a focused text input on mobile should
suppress focus transfer with `event.preventDefault()` on `pointerdown` /
`mousedown` (and `touchstart` for older WebViews) if the interaction is
meant to feed the input without breaking typing flow. `tabIndex={-1}` alone
is not sufficient — it prevents keyboard-tab focus but not pointer-driven
focus transfer.
