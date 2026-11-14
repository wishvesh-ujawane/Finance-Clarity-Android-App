---
id: decision-0011
title: ADR-0011 — Allow Google's profile-photo host as a network destination
date: 2026-11-14
updated: 2026-11-14
status: accepted
scope: [financial-clarity, api, privacy]
related:
  - ../features/profile.md
  - ../features/backup-restore.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/ProfileAvatar.tsx
  - artifacts/financial-clarity/src/lib/googleAuth.ts
---

# ADR-0011 — Allow Google's profile-photo host as a network destination

## Context
Google sign-in returns the user's photo as a URL (`imageUrl`) on Google's
image host, normally `https://lh3.googleusercontent.com/...`. The app has shown
this photo on the Backup card since Drive backup was added, and the Profile page
(PR #32) shows it on Settings, Profile, and the Backup card. Loading it is a
network request, but the host was not in the allowed destinations list
(API.md §1.1). ARCHITECTURE §20 says a new destination needs an ADR and owner
approval.

## Decision
The owner approved the host on 2026-11-14. The app may load the user's own
Google profile photo from `https://*.googleusercontent.com`, as an image request
only. `ProfileAvatar` checks the URL first. Any other host, plain `http`, or an
unparseable URL is not loaded, and the initial is shown instead.

## Alternatives considered
- **Show no photo, only the initial.** No extra destination, but it does not
  meet the owner's request to show the Google photo.
- **Download the photo once and cache it on the device.** This needs a new
  storage key and more personal data at rest, for little benefit.
- **Allow any URL the sign-in plugin returns.** The profile cache is read from
  device storage, so its value is untrusted. Checking the host keeps the
  allow-list enforced in code.

## Consequences
- Positive: the documented destinations now match what the app actually loads.
  The allow-list is enforced in code.
- Negative: while signed in, opening Settings, Profile, or Backup & Restore makes
  an image request to Google. It carries the device's IP address and standard
  headers, but no referrer and no app data. Google already holds this photo.
- Follow-ups: list the request in the Play Data safety form with Google
  sign-in (D9). If a future CSP is added (PROGRESS §4.4), its `img-src` must
  include `https://*.googleusercontent.com`.

## Supersedes / superseded by
None.
