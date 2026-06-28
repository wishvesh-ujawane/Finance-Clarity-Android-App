---
id: feature-onboarding
title: Onboarding flow (intro → auth → restore choice)
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./security.md
  - ./backup-restore.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/onboarding/IntroCarousel.tsx
  - artifacts/financial-clarity/src/components/onboarding/OnboardingFlow.tsx
---

# Onboarding flow

## User-visible behavior
First-launch flow with three steps managed by
[OnboardingFlow.tsx](../../../artifacts/financial-clarity/src/components/onboarding/OnboardingFlow.tsx):

1. **intro** — three-slide
   [IntroCarousel](../../../artifacts/financial-clarity/src/components/onboarding/IntroCarousel.tsx)
   with customisable icons, colours, and glow.
2. **auth** — Google sign-in step.
3. **restore-choice** — option to restore from an existing backup before
   creating a fresh dataset.

## Intro carousel interactions
- **Swipe**: `touchStart` / `touchEnd` with a **50 px** threshold (lines 67–77 of
  `IntroCarousel.tsx`). Not Framer Motion — direct touch listeners.
- **Keyboard**: ArrowLeft / ArrowRight.
- **Buttons**: Back (disabled on slide 0), Next on intermediate slides, "Get
  started" on the last slide.
- **Dots indicator** (lines 133–148): active dot `w-8 bg-white`, inactive dot
  `w-2 bg-white/25`.

## State
Local component state for the active slide. The parent `OnboardingFlow`
advances through `intro → auth → restore-choice → app` and persists
completion.

## Edge cases
- Restore-choice "Skip" leads to an empty fresh dataset.
- Restore-choice "Restore" hands off to [backup-restore.md](./backup-restore.md).

## Known gotchas
- Carousel uses a hand-rolled swipe handler instead of Framer Motion, so
  feeling differs from the [Analysis](./analysis.md) screen swipe.
