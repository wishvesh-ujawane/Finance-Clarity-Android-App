# Fiscal Focus — Progress Snapshot

**Last updated:** 2026-11-14
**Purpose:** a quick restart point. Read this first, then open only the core
documents you need for the next task. This file is a summary, not a source of
truth. If it disagrees with a core document (see [AGENTS.md](../AGENTS.md) §1.1),
the core document wins.

---

## 1. Where things stand

| Item | State |
|---|---|
| Product | "Fiscal Focus" — offline, single-user, INR-only Android finance tracker (Vite + React + Capacitor) in `artifacts/financial-clarity/` |
| App version | `1.0.0` (`artifacts/financial-clarity/package.json`) |
| `main` | `1545dac` — contains Phases 1–10, the owner-decisions follow-up, the UI polish (PR #28), card dues / budget summary / Trends (PR #29), and the Profile page (PR #32) |
| Open branches | None with unmerged work. Start new work from an up-to-date `main` |
| Storage version | `storage-version` 3 (local migrations 1–3 in `lib/storage/local-migrations.ts`) |
| Backup schema | v6 (`BACKUP_VERSION` in `lib/backup.ts`); restores v1–v5, refuses newer |
| Last full check (2026-11-14, PR #32) | Typecheck and 338 unit tests passed; lint clean on changed files. Playwright: navigation 10/10, layout/journey/accessibility 23 passed and 23 skipped by config. Build and the full e2e suite were not rerun |
| Uncommitted | `docs/Screenshots/` (owner's device screenshots, untracked) |

---

## 2. What is built

### 2.1 Screens (routes in `src/App.tsx`)

| Route | Screen | Highlights |
|---|---|---|
| `/` | Dashboard | Period selector, PRD §6 totals, budget status chips, "On your card" chip that opens the card sheet, month-end review banner, Drive connect banner |
| `/transactions` | Transactions | Entry sheet with calculator and live Indian comma grouping, "Paid with credit card" checkbox, consumption-based "Spending" tile and day totals, double-submit guard, delete confirmation that names the entry |
| `/budgets` | Budgets | Monthly limits per category, accordion layout, shared budget summary, "Copy to {month}" with a confirmation that lists every overwrite |
| `/analysis` | Analysis | Overview (same budget summary as Budgets), safe-to-spend, projections with "Insufficient history", Trends (category changes and top-5 category trend), drilldowns, image share |
| `/settings` | Settings hub | Round profile button (top right) and links to the pages below |
| `/settings/profile` | Profile | Google name, email, and photo (read-only; Refresh from Google), sign in and Disconnect, link to Security. Works signed out |
| `/settings/security` | Security | Reached from Profile. PIN (salted hash) and biometric lock, escalating cooldown, `FLAG_SECURE` while the lock is on |
| `/settings/recurring` | Recurring expenses | Rules with pause/resume; generation runs after unlock and on resume |
| `/settings/categories` | Categories | Active/inactive status; used or reserved categories cannot be deleted; a category with an active recurring rule cannot be made inactive |
| `/settings/backup` | Backup & restore | Google Drive backup (`drive.file` scope), restore with preview, CSV import/export |
| `/settings/savings` | Savings goals | Savings targets and contributions |
| `/settings/changelog` | What's New | Bundled release notes; every user-visible app change adds a dated line without separate approval (AGENTS §13.1) |

Also: onboarding flow, Month-End Review (snapshot, Card bill step, card-aware
Reconcile that keeps savings separate from the bank balance, Plan ahead budgets,
confetti), speed-dial FAB, lock screen, storage error screens, Not Found page.

### 2.2 Architecture in place (`artifacts/financial-clarity/src`)

| Layer | Files |
|---|---|
| Domain (pure) | `lib/domain/` — `finance-metrics.ts` (every PRD §6 metric), `periods.ts`, `budgets.ts`, `recurring.ts` (pure scheduler), `analysis.ts` |
| Storage | `lib/storage/` — `keys.ts` (one key catalogue), `schemas.ts` (type-guard validators), `finance-storage.ts` (persist-first, typed results, rollback), `finance-read.ts`, `local-migrations.ts`, `migrations.ts`, `startup.ts` (storage check, quarantine) |
| Platform | `lib/platform/share-image.ts`; Google auth/Drive modules still in `lib/` (rename pending, ARCHITECTURE A14) |
| State | `context/` — `FinanceContext`, `SecurityContext`, `BackupContext`, `MonthEndReviewContext`, `FabContext` |
| Formatting | `lib/format.ts` — compact display, full precision in inputs and confirmations, short format on charts |

### 2.3 Removed

SMS import (code, plugin, route, `READ_SMS`), Firebase Crashlytics (D9),
server/DB/API-codegen scaffolds, Replit config, unused UI primitives and
packages, `date-fns`, `zod`, `react-hook-form`.

### 2.4 Tooling

- pnpm workspace, `minimumReleaseAge: 1440`.
- Vitest + React Testing Library; Playwright e2e in `artifacts/financial-clarity/e2e/` (including axe WCAG 2.1 AA checks and a 320/360/412 px layout audit).
- ESLint (ADR-0009).
- CI on pull requests: `.github/workflows/ci.yml` (frozen install → typecheck → Vitest → build).
- Android build helpers: `scripts/build-debug-apk.ps1`, `scripts/clean-build.ps1`. See [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) and [BUILD_ON_HOME_PC.md](./BUILD_ON_HOME_PC.md).

---

## 3. History in one table

| When | Work | Record |
|---|---|---|
| 2026-06-28 | Knowledge base set up; budget headline math unified | ADR-0001, ADR-0002 |
| 2026-07-05 | Vitest setup, safe money input parser, Month-End Review flow, feature backlog | ADR-0003 |
| 2026-08 | Budgets accordion, FAB speed-dial, Indian comma grouping | [manuals/2026-08-28-budgets-fab-ux.md](./manuals/2026-08-28-budgets-fab-ux.md) |
| 2026-11-06 | Dead-code cleanup; SMS removed; audit fixes (lock exposure, CSV safety, Drive overwrite guard, used-category deletion, persist-first writes) | [audits/2026-11-06-e2e-browser-audit.md](./audits/2026-11-06-e2e-browser-audit.md) |
| 2026-11-11 | Recurring occurrence identity, persist-first for all finance writes, Phases 1–2 | ADR-0004, ADR-0005 |
| 2026-11-12 | Phases 3–10 (metrics, categories, recurring scheduler, journeys, Analysis, backup/share, design/a11y, CI); owner decisions D6–D9; savings reconciliation; What's New screen | ADR-0006–0008; [audits/2026-11-12-phases-implementation-review.md](./audits/2026-11-12-phases-implementation-review.md) |
| 2026-11-13 | UI polish: semantic tokens, 48 px targets, shared `PeriodSelector`, ESLint, axe checks (PR #28) | ADR-0009 |
| 2026-11-14 | Card dues ("Paid with credit card", card sheet), one budget summary, new Trends (PR #29, merged into `main`) | ADR-0010, PRD D11 |
| 2026-11-14 | Profile page behind a Settings avatar button; Security and Google account moved there; account switch clears the Drive folder cache (PR #32) | DESIGN §5.21, §13.17; [features/profile.md](./knowledge-base/features/profile.md) |

Full line-by-line history: [knowledge-base/CHANGELOG.md](./knowledge-base/CHANGELOG.md).

---

## 4. Open items

### 4.1 Follow-ups from recent merges

- PR #29 What's New entry added (2026-11-14, second card for that date).
- PR #29: device check of the card chip, card sheet, and checkbox at 130% font size.
- PR #32: device check of Profile — sign in, Refresh from Google (same and different account), Disconnect, Security back button ([BUILD_ON_HOME_PC.md](./BUILD_ON_HOME_PC.md) §9).
- PR #32 What's New entry added (2026-11-14). Google's profile-photo host is now an allowed destination ([ADR-0011](./knowledge-base/decisions/0011-google-profile-photo-host.md)); list it with Google sign-in on the Play Data safety form.

### 4.2 Manual device checks (need a phone, release build, Android SDK)

From [testing.md](./testing.md) "Release verification":

- Airplane-mode add, then restart.
- Recurring catch-up after the app stays closed across a due date.
- `gradlew :app:processReleaseMainManifest` shows no `READ_SMS`.
- Install over the previous release.
- 130% font size and keyboard-open forms.
- TalkBack pass.
- Safe areas on a notched or gesture-nav phone.
- Drive back up → reinstall → restore.
- Card bill step in Month-End Review.
- Run `cap sync android` to regenerate the ignored plugin list.

### 4.3 Before Play Store submission

- Privacy policy and Play Data safety form (D9; outside the code).

### 4.4 Documented gaps not yet fixed

| ID | Gap |
|---|---|
| ARCHITECTURE A10 | `FinanceContext` is about 1,400 lines; split into domain + storage with the same hook API |
| ARCHITECTURE A13 | Capacitor modules imported both statically and dynamically |
| ARCHITECTURE A14 | File names that break the naming rules (`backupHash.ts`, `googleAuth.ts`, `googleDrive.ts`, `not-found.tsx`) — rename when next changed |
| ARCHITECTURE A16 | Single ~1.2 MB JS chunk; lazy-load heavy routes |
| Phase 2 leftover | Non-finance modules (security, onboarding, month-end review, Google profile cache, backup preferences) still call `localStorage` directly |
| DESIGN G6 | Transactions and Budgets have no period selector (needs approval) |
| DESIGN G11 | Dense 7-column grids are below 48 px (exception pending approval) |
| DESIGN §13 | Collapsible Inactive section on Categories |
| Security | Content Security Policy not added |
| Month-end (D8) | Repeat reconciliation and adjustment duplication still pending owner review; month-end cards use the full-precision formatter |

### 4.5 Settled decisions (do not reopen without the owner)

- D7: no backup download size guard and no blocking pre-restore copy for now.
- FR-07: deleting a generated recurring occurrence does not suppress it permanently.
- CI actions stay pinned by major tag.

Ideas for future work (not approved): [knowledge-base/requirements/20260705-feature-backlog.md](./knowledge-base/requirements/20260705-feature-backlog.md).

---

## 5. Quick commands

Run from the repository root:

```powershell
pnpm install
pnpm --filter @workspace/financial-clarity run test:run   # Vitest
pnpm run typecheck                                         # required before "done"
pnpm run build
.\scripts\build-debug-apk.ps1                              # debug APK (needs Android SDK)
```

---

## 6. Keeping this file current

After each merged change, update §1 (branch, versions, last check), add a row
to §3, and move finished items out of §4. Keep detail in the knowledge base and
core documents, not here.
