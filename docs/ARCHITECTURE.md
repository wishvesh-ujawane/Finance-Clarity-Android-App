# Fiscal Focus — Architecture

**Version:** 1.0
**Updated:** 2026-11-05
**Inputs:** [PRD.md](./PRD.md) v1.1 (product scope), [DESIGN.md](./DESIGN.md) v1.0 (UX and design system), current source in `artifacts/financial-clarity/`
**Status:** Target architecture. Items marked **MVP-cleanup** describe how existing code should converge on this design; they are not authorized for implementation by this document alone (PRD §15, "Execution").

---

## 0. Architecture in One Paragraph

Fiscal Focus is a **single-user, offline-first Android app**. It is one React single-page application, packaged with Capacitor, that keeps all financial data on the device. Google Drive is an **optional, user-owned backup destination**, not a sync service. There is **no backend, no server database, no user account system, and no AI service**. All financial math runs locally in one shared, pure domain layer so that every screen shows the same numbers. Everything beyond this is listed under [Future](#18-mvp-vs-future-scalability) and needs an ADR and owner approval.

Labels used in this document:

| Label | Meaning |
|---|---|
| **MVP** | Required for the Google Play release described in PRD §13 |
| **MVP-cleanup** | Existing code that must converge on this architecture before release |
| **Future** | Documented direction only; not authorized; requires ADR + owner approval |

---

## 1. Architectural Drivers

| Driver | Source | Architectural consequence |
|---|---|---|
| Works offline, no sign-in required | PRD §3, §12 | All core data and logic on device; no server dependency |
| Equivalent totals match across screens | PRD §6, §12, §14.2 | One pure domain module owns every financial definition; screens never recompute |
| Never report success before a durable save | PRD §9, §11; DESIGN §1.2, §7.3 | Persist first, then update state; storage errors are returned, never swallowed |
| Old data and backups keep working | PRD FR-01, FR-11, §9 | Frozen storage keys, versioned schemas, forward-only migrations |
| Remove SMS completely | PRD FR-10 | Delete SMS code, routes, plugin, and permission; keep legacy data readable |
| Privacy and Play Store readiness | PRD FR-12, D9 | Minimal permissions, no analytics, scrubbed diagnostics, accurate disclosures |
| Maintainability | PRD §12 | Reuse existing contexts and UI conventions; no new state or infrastructure frameworks |

---

## 2. Recommended Tech Stack

The stack below is mostly what already exists. The recommendation is to **keep it and remove what is unused**, not to add more.

### 2.1 Product stack (MVP)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript ~5.9 (strict) | Type safety for money and date logic; already standard across the workspace |
| UI framework | React 19.1 | Existing codebase; mature; works well inside a WebView |
| Build tool | Vite 7 | Fast dev loop; outputs static assets for Capacitor (`dist/public`) |
| Native shell | Capacitor 8 (Android only; minSdk 24, target/compile SDK 36) | One web codebase, plus access to native biometrics, sharing, and files; meets the Play target-API requirement |
| Styling | Tailwind CSS 4 with semantic design tokens | Implements DESIGN §2–4; tokens prevent hard-coded colors (DESIGN G13) |
| UI primitives | Radix-based copies in `components/ui` | Accessible dialogs, sheets, and switches; keep only the ones actually used |
| Routing | wouter 3 | Very small; enough for about 12 routes |
| Forms | Controlled React state + shared validators | Validates on submit/blur and keeps entered values (DESIGN §7). No form library |
| Validation | Hand-written TypeScript type guards | One validator per entity for forms, stored data, backups, and CSV import (as in `lib/backup.ts`). No schema library |
| Charts | Recharts | Existing Analysis charts |
| Motion | Framer Motion | Existing sheets and swipes; must respect reduced motion (DESIGN §9.4) |
| Icons | lucide-react (+ local brand icons) | One icon set (DESIGN §4.5) |
| Dates | Shared helpers in `finance-utils.ts` (`currentMonth`, `addMonths`, `localDateStr`) | Month math, short months, local-date handling. No date library |
| Toasts | Radix toast (`components/ui/toast`, `hooks/use-toast`) | Persistent toasts for background operations (DESIGN §8.2) |
| Image export | html-to-image | Analysis Overview image share (PRD FR-08) |
| Fonts | Manrope + Inter, **bundled locally** | Works offline; no runtime call to Google Fonts (DESIGN G7) |
| Testing | Vitest + React Testing Library + jsdom | Already configured |
| Monorepo tooling | pnpm 10, Node 24 | Existing workspace; supply-chain policy in `.npmrc` |

### 2.2 Native plugins (MVP)

| Plugin | Purpose |
|---|---|
| `@capacitor/app` | App lifecycle (background lock, resume processing), Android back button |
| `@capacitor/filesystem`, `@capacitor/share` | CSV and image export through the system share sheet |
| `@capgo/capacitor-native-biometric` | Optional biometric unlock |
| `@codetrix-studio/capacitor-google-auth` | Google sign-in for Drive authorization only |
| `@capacitor-firebase/app`, `@capacitor-firebase/crashlytics` | Crash diagnostics, pending privacy review (D9) |
| Local `ScreenSecurity` plugin (`android/app/.../ScreenSecurityPlugin.java`) | Sets `FLAG_SECURE` while the app lock is enabled (§15.3) |

### 2.3 Explicitly not used in the MVP

| Item | Reason |
|---|---|
| Server, database, and API-codegen packages (`api-server`, `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`) and the `mockup-sandbox` design tool | PRD §10: no finance backend. Deleted from the workspace on 2026-11-06 |
| `@tanstack/react-query` | There is no server state to cache. Removed from the app on 2026-11-06 (A6) |
| `@workspace/api-client-react` dependency in the app | Never imported. Removed from the app on 2026-11-06 (A6) |
| `react-hook-form`, `zod`, `date-fns` | Never used by the app. Removed on 2026-11-06; see §2.1 for what replaces them |
| Replit hosting, config, and Vite plugins | Not used. Removed on 2026-11-06 |
| Global state libraries (Redux, Zustand, etc.) | Existing React contexts are enough for one user's local dataset |
| Analytics, ads, attribution, or remote-config SDKs | PRD §14: no new telemetry |
| AI or LLM SDKs | PRD §3, §13: out of scope |
| SMS plugins or parsers | PRD FR-10: removed |

### 2.4 Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Native Kotlin/Compose rewrite | Throws away a working codebase; no requirement it would meet better |
| React Native / Flutter | Same rewrite cost; Capacitor already covers the needed native features |
| Backend with cloud sync now | PRD §10 and §13 forbid it; it would add accounts, servers, and privacy scope |
| SQLite immediately | Not needed at current data sizes; adds a native dependency and a migration. Planned as a Future trigger-based change (§8.7) |

### 2.5 Dependency policy

- Any new **runtime** dependency needs a short written reason in the PR. Prefer platform APIs (WebCrypto, `Intl`) and existing packages.
- Keep `minimumReleaseAge: 1440` in `.npmrc`. Commit the lockfile. Use pnpm only.
- Before each release, remove unused dependencies, including unused `components/ui` primitives and their Radix packages.

---

## 3. System Context

```
┌──────────────────────────── Android device (app sandbox) ────────────────────────────┐
│                                                                                       │
│   Fiscal Focus — Capacitor WebView                                                    │
│   ┌───────────────────────────────────────────────────────────────────────────────┐   │
│   │ React SPA                                                                     │   │
│   │   Pages / Components ─▶ Contexts (state) ─▶ Domain (pure financial rules)     │   │
│   │                               │                                               │   │
│   │                               ├─▶ Storage adapter ─▶ WebView localStorage     │   │
│   │                               └─▶ Platform adapters ─▶ Capacitor plugins      │   │
│   └───────────────────────────────────────────────────────────────────────────────┘   │
│        Native: BiometricPrompt · App lifecycle · Filesystem · Share sheet             │
└──────────┬──────────────────────────────┬───────────────────────────────┬─────────────┘
           │ HTTPS + OAuth (drive.file)   │ HTTPS (native SDK)            │ User-initiated intents
           ▼                              ▼                               ▼
   Google Sign-In + Drive API     Firebase Crashlytics           Share targets, Email, WhatsApp
   (optional backup/restore)      (if configured; D9 pending)    (exports and feedback)
```

There are no other network destinations. Every finance feature works with all network arrows removed.

---

## 4. Frontend Architecture

### 4.1 Layers and dependency rule

| # | Layer | Location | Responsibility | May depend on |
|---|---|---|---|---|
| 1 | App shell | `src/main.tsx`, `src/App.tsx` | Provider tree, routes, overlay priority, top-level error boundary | 2–7 |
| 2 | Pages | `src/pages/` | Build one screen from components and context hooks | 3, 4, 5 (formatters/selectors only) |
| 3 | Components | `src/components/` | Presentational UI following DESIGN §5; receive data and callbacks | 3, 5 (formatters only) |
| 4 | State (contexts) | `src/context/` | Hold in-memory state, expose actions, coordinate domain, storage, and platform calls | 5, 6, 7 |
| 5 | Domain | `src/lib/domain/` | Pure TypeScript: financial baseline, period boundaries, recurring scheduler, category rules, budget copy, analysis, month-end math. No React, no I/O | nothing (types only) |
| 6 | Storage | `src/lib/storage/` | **The only code that touches `localStorage`**: keys, schemas, migrations, quarantine, typed results | 5 (types/schemas) |
| 7 | Platform adapters | `src/lib/platform/` | **The only code that calls Capacitor plugins or Google APIs**; provides web fallbacks | nothing above it |

Dependencies only point down the table. Pages and components never import `localStorage`, `@capacitor/*`, or Google modules directly. Enforce this in code review; a lint rule is optional.

### 4.2 State management

Keep the existing contexts and give each a clear owner role:

| Context | Owns |
|---|---|
| `FinanceContext` | Transactions, categories, budgets, recurring rules, savings targets, reconciliation, selected month. **Only writer of finance entities.** |
| `SecurityContext` | Lock configuration, lock/unlock state, cooldown, background-lock timer |
| `BackupContext` | Google connection state, backup preferences, backup/restore operations and status |
| `MonthEndReviewContext` | Review eligibility and per-month completion/dismissal |
| `FabContext` | Per-screen FAB action registration |

Rules:

- **Derived values come from domain selectors**, memoized in the context, for example "summary for period P". A metric from PRD §6 is computed in exactly one function. Pages must not re-sum transactions themselves.
- Each action returns a success or failure result to its caller. A sheet or form decides how to show that result (DESIGN §7.3).
- **MVP-cleanup:** `FinanceContext` is about 1,400 lines. Move its calculations and rules into `lib/domain/` and its persistence into `lib/storage/`. Keep its public hook API unchanged so pages are unaffected.

### 4.3 Routing and navigation

- Routes: `/`, `/transactions`, `/budgets`, `/analysis`, `/settings`, and Settings sub-pages (`/settings/categories`, `/settings/recurring`, `/settings/savings`, `/settings/security`, `/settings/backup`), plus Not Found. **MVP-cleanup:** remove `/settings/sms-auto-import`.
- The Android back button is handled once in the app shell through `@capacitor/app`. It closes the topmost layer first, in DESIGN §6.4 order: FAB menu → dialog → sheet → sub-page → Dashboard → exit.
- Launch overlays appear in a strict order: **lock screen → onboarding → month-end prompt**. Only one appears at a time (DESIGN §6.5).
- While the app is locked, financial screens are **not rendered at all**. Hiding them visually is not enough. The lock screen is the topmost layer (DESIGN G12).

### 4.4 UI system

- All colors, spacing, radii, and type come from tokens in `index.css` and the Tailwind theme (DESIGN §2–4). No raw hex or hsl values in components.
- One canonical amount formatter and one date/month formatter (DESIGN §4.6, G8).
- Respect safe-area insets everywhere (G9). All motion respects reduced motion (G10). Touch targets are at least 48 px (G11).

---

## 5. Backend Architecture

**MVP: there is no backend.** The app talks only to on-device storage, native plugins, and Google Drive under the user's own authorization.

The workspace contains a single package, `artifacts/financial-clarity`. The former server, database, and API-codegen scaffolds and the `mockup-sandbox` design tool were deleted on 2026-11-06. Adding any backend requires an ADR and owner approval (§10.4, §18).

---

## 6. Data Flow

### 6.1 App startup

1. `main.tsx` mounts the app. On native builds only, crash reporting starts if it is configured.
2. **Storage load.** The storage adapter reads every key, parses it, checks it against its schema, and runs any pending local migrations.
   - An invalid item or key is **quarantined**: the original raw text is copied to `financial-clarity:backup:<key>:<timestamp>` and is never silently overwritten.
   - If core data cannot be read at all, show a full-screen explanation. Offer no action that overwrites data without explicit confirmation (DESIGN §8.2).
3. **Security.** If the lock is enabled, show only the lock screen until unlock succeeds.
4. **Onboarding.** Show it if onboarding is incomplete. Offer the restore choice; starting fresh never deletes existing records (PRD FR-01).
5. **Recurring processing** runs after unlock, and again on every app resume (§6.4).
6. **Month-end prompt.** Evaluate eligibility; never show it over the lock screen, onboarding, or an open sheet.
7. **Auto-backup check.** If Google is connected and preferences allow it, run in the background without blocking the UI (§6.5).

### 6.2 Write path (every mutation)

```
User input
  → Form validation (shared entity validator)          → field errors, values preserved
  → Context action
      → Domain: check business rules                  → e.g. "category is used, cannot delete"
      → Domain: compute next state (pure)
      → Storage: write (synchronous, returns ok | error)
          ok    → commit to React state → UI and derived totals update → sheet closes
          error → React state unchanged → error returned → sheet banner, values preserved
```

Rules:

- **Persist before commit.** Update in-memory state only after the storage write succeeds (PRD §9: "do not equate an in-memory update with a durable save").
- Submit buttons enter a busy state immediately and ignore repeated taps (DESIGN §7.3).
- Writes that touch several keys (restore, recurring catch-up) snapshot the previous values first and roll back if any write fails.
- **MVP-cleanup:** today `saveToStorage` ignores errors and runs after state has already changed. Replace it with the persist-first flow above.

### 6.3 Read and derive path

```
Stored entities → Domain selectors (shared period boundaries, PRD §6 definitions) → memoized in context → pages/components → canonical formatter
```

Income, consumption spending, savings contributions, monthly net, carry-forward, lifetime balance, commitments, and outstanding card amount each have **exactly one implementation** in the domain layer.

### 6.4 Recurring generation (PRD FR-07, D4)

- **Occurrence identity.** Each occurrence is identified by rule ID + month (`YYYY-MM`). Every generated transaction stores that identity.
- **Scheduling.** For each active rule, check every month from the later of its start month and its last processed month up to the current month:
  - skip months that fell inside a paused period;
  - set the date to the scheduled day, or the last day of the month if that day does not exist;
  - generate only if that date is today or earlier.
- **Idempotency.** Before generating, look for an existing transaction with the same occurrence identity. Running the processor any number of times produces each occurrence at most once, even if the app was interrupted mid-run.
- **Single-flight.** Only one processing run at a time. All new occurrences and updated rule tracking are saved in one persist-first commit.
- **Pending (PRD FR-07):** whether deleting a generated occurrence suppresses it permanently. Until that is decided, never recreate a transaction the user deleted. Record suppression in the rule's generation tracking.

### 6.5 Backup and restore (PRD FR-11, existing behavior preserved)

**Backup:**

1. Snapshot the backed-up keys.
2. Build a backup file: schema version (currently 3), app version, export time, device info, and the data block.
3. Compute a stable SHA-256 hash of the data block. Skip auto-backup if it has not changed.
4. If the Drive backup holds **more transactions** than the device, or cannot be read, do not upload. Manual backup asks the user; on confirmation, first save the current Drive file as `finance-clarity-backup.pre-overwrite-<timestamp>.json` in the same folder, and abort if that copy fails. Auto-backup never replaces it; it records a "paused" notice instead.
5. Upload to the app's Drive folder using `drive.file` scope.
6. Record the status in Backup settings.

**Restore:**

1. List and download the backup, then parse it.
2. Validate its structure. Refuse a **newer** schema version with an "update the app" message.
3. Migrate older versions forward step by step.
4. Show a preview of the backup metadata. The user confirms that it will replace local data.
5. Snapshot current values, write the restored data, and roll back if any write fails.
6. Reload state and report the result.

**Exclusions** (disclosed to users per FR-11): reconciliation records, review completion, onboarding, lock settings, Google session, and backup preferences. Legacy SMS keys are carried for compatibility only and never reactivate SMS features.

### 6.6 CSV and image export/import

- **CSV export:** select records → build CSV (the label matches the records actually included) → write to the app cache → open the system share sheet. Escape cells that start with `=`, `+`, `-`, or `@` to prevent formula injection in spreadsheets.
- **CSV import:** parse → validate each row → detect duplicates → preview counts → commit through the normal write path → report imported, skipped, and invalid counts.
- **Image export:** render the Overview pane to PNG → share. Failures are shown to the user, not only logged (DESIGN G16).

---

## 7. Folder Structure

### 7.1 Repository

```
Finance-Clarity-Android-App/
├── AGENTS.md                                 # rules for coding agents (stays at the root)
├── artifacts/
│   └── financial-clarity/                    # THE PRODUCT (MVP) — the only workspace package
│       ├── android/                          # Capacitor Android project (Gradle, manifest, signing config)
│       ├── e2e/                              # Playwright end-to-end tests
│       ├── public/                           # static assets, bundled fonts
│       ├── src/                              # see 7.2
│       ├── capacitor.config.ts               # appId, appName, plugin config
│       └── vite.config.ts
├── docs/
│   ├── PRD.md · DESIGN.md · ARCHITECTURE.md · DATABASE.md   # product, design, architecture, data sources of truth
│   ├── IMPLEMENTATION_PLAN.md · testing.md
│   ├── knowledge-base/                       # canonical KB
│   ├── audits/ · manuals/
│   └── BUILD_AND_DEPLOY.md · BUILD_ON_HOME_PC.md
├── scripts/
│   └── build-debug-apk.ps1 · clean-build.ps1 # Android build helpers; run from any directory
└── package.json · pnpm-workspace.yaml · .npmrc · tsconfig.base.json
```

### 7.2 App source (`artifacts/financial-clarity/src`)

```
src/
├── main.tsx
├── App.tsx                     # providers, routes, overlay priority, error boundary, back handling
├── index.css                   # design tokens
├── pages/                      # one file per route
├── components/
│   ├── ui/                     # primitives (DESIGN §5); only those in use
│   ├── analysis/ · month-end/ · onboarding/ · icons/
│   └── <shared feature components: sheets, dialogs, Navigation, FAB, LockScreen>
├── context/                    # Finance, Security, Backup, MonthEndReview, Fab
├── hooks/
└── lib/
    ├── domain/                 # pure rules: baseline metrics, periods, recurring, categories,
    │                           #   budgets, analysis, month-end
    ├── storage/                # key catalogue, entity schemas, local migrations, repository
    ├── backup/                 # backup format, hash, backup-schema migrations
    ├── platform/               # biometric, googleAuth, googleDrive, share/filesystem,
    │                           #   crashlytics, app lifecycle
    ├── csv.ts
    ├── format.ts               # canonical amount and date formatters
    └── types.ts                # domain entity types
```

- Tests sit next to the code in `__tests__/` folders.
- **MVP-cleanup, removed entirely:** `components/sms/`, `lib/sms/`, `pages/SmsAutoImport.tsx`, and their tests and fixtures.
- **Migration approach:** move files into `domain/`, `storage/`, and `platform/` when they are next changed, one layer per PR. No big-bang reorganization.

---

## 8. Database Interaction (On-Device Persistence)

### 8.1 Store

- **Engine:** WebView `localStorage`, private to the app sandbox. Reads and writes are synchronous. Data is stored as JSON per key.
- **Capacity:** typically about 5 MB per origin in Android WebView; treat that as a hard limit. At a few hundred bytes per transaction, this holds tens of thousands of records, which is enough for the MVP. Measure with realistic datasets on the reference devices (PRD §14, pending).
- **Not encrypted at rest.** The app discloses this (PRD FR-12).
- `android:allowBackup="false"` stays. Android's own cloud backup does not copy finance data, so Drive backup is the only cloud recovery path. Onboarding and Backup screens must say so.

### 8.2 Key catalogue

| Rule | Detail |
|---|---|
| Prefix | `financial-clarity:` is **frozen**. Do not rename it for the Fiscal Focus brand (PRD FR-01) |
| Finance collections | One key per collection: transactions, categories, budgets, recurring rules, savings goal, reconciliation |
| App state | Security settings, backup preferences, Drive folder cache, Google profile cache, onboarding flags, month-end review state |
| Quarantine | `financial-clarity:backup:<key>:<timestamp>` holds raw text that failed validation |
| Legacy | SMS keys are kept read-only for backup compatibility. Never deleted silently (PRD FR-10) |
| New (MVP) | `financial-clarity:storage-version`, used to track local schema migrations |

All key names live in one module in `lib/storage/`. No other file contains key strings.

### 8.3 Schemas and validation

- Each entity has one validator (a TypeScript type guard). It is used for storage reads, backup restore, and CSV import.
- Invalid records are quarantined, never silently dropped. Show a non-blocking startup banner saying how many records could not be read and that the raw data was kept.

### 8.4 Migrations

- **Local migrations** are ordered, forward-only, and idempotent. They run at startup before any context reads data, and record the new storage version only after all writes succeed.
  - First planned migration: add `active: true` to every existing category so current categories stay usable (PRD FR-03, §9).
- **Backup migrations** run in parallel with local migrations. Adding category status raises the backup schema version from 3 to 4. Old backups restore through the migration chain; newer backups are refused.
- Google Play cannot roll an app back to an older version. A migration must never leave data that the current code cannot read.

### 8.5 Data-modeling rules

| Concern | Rule |
|---|---|
| Identifiers | Stable string IDs; never reused or rewritten |
| Money | Keep the existing representation: a positive number of rupees, with direction set by transaction type. **No new monetary model** (PRD §6). Round only in the formatter. All sums go through shared domain helpers |
| Financial dates | Local calendar date as `YYYY-MM-DD` (date-only) |
| Event timestamps | ISO-8601 UTC (backups, reconciliation, review state) |
| Months | `YYYY-MM`. Period boundaries are computed in the device's local time zone by one shared helper |
| References | By ID. A category referenced by any transaction, budget, or recurring rule counts as "used" and can never be hard-deleted; it can only be made inactive |
| Enforcement | Business rules such as "cannot delete a used category" are enforced in the domain mutation, not only by hiding UI (PRD FR-03) |

### 8.6 Durability

- Writes follow the persist-first flow (§6.2). Quota and storage errors reach the user with a clear statement of whether anything was saved.
- Do not use asynchronous write-behind caching. Synchronous `localStorage` writes make "saved" mean saved.

### 8.7 Future: SQLite

- **Triggers:** stored data above about 2 MB, noticeable startup cost, or a need for indexed queries or multi-entity transactions.
- **Path:** keep the storage adapter's interface, swap in a SQLite implementation through a Capacitor plugin, and run a one-time verified copy from `localStorage`. Keep the old keys until the copy is verified.
- A server database is considered only if multi-device sync is approved.

---

## 9. Authentication and Authorization

### 9.1 Identity model

- **No accounts.** One local user per device dataset (PRD §8).
- Google sign-in **only grants access to Drive for backup**. It is not a finance identity and is never needed for core features.

### 9.2 App lock (PRD FR-12)

| Aspect | Design |
|---|---|
| PIN | Four digits, stored as a salted SHA-256 hash (WebCrypto) in the security settings key. The PIN itself is never stored |
| Biometrics | Android BiometricPrompt through the native plugin. A convenience option; the PIN is always the fallback |
| Cooldown | Failed attempts trigger an escalating cooldown. Cooldown state is saved so restarting the app does not reset it. Every fifth consecutive failure starts a cooldown of 30 s, then 1 min, 5 min, and 15 min (maximum); a successful unlock clears the count. PIN and biometric unlock are refused during a cooldown |
| Background lock | `appStateChange` starts a timer; the app locks when it returns to the foreground after the timeout |
| Change or disable | Requires the current PIN |
| Forgotten PIN | Explicit warning that recovery **deletes local data**, then a full local reset |
| Honest limits | The lock prevents casual access only. Storage is not encrypted, and a four-digit hash can be brute-forced by anyone with file-system access. This is disclosed in the UI |

### 9.3 Google authorization

- **Scopes:** `profile`, `email`, `https://www.googleapis.com/auth/drive.file`. `drive.file` is the least-privilege scope: the app can see only files it created.
- **Tokens:** the plugin manages them. Only display profile data is cached locally. Tokens are never written to app storage or logs.
- **Disconnect:** signs out and clears cached profile data. It does **not** delete local records or remote backups (PRD FR-11).
- **Risk:** the Google auth plugin version is a release candidate (`3.4.0-rc.4`). Keep it pinned. **Future:** evaluate a stable replacement such as Android Credential Manager with separate Drive authorization.

### 9.4 Authorization matrix

| State | Can access |
|---|---|
| Locked | Lock screen only; no financial content rendered |
| Unlocked, local only | All core features |
| Unlocked, Google connected | Core features + Drive backup/restore |
| Offline | Core features; Drive actions explain that they are unavailable |
| Unsupported device capability (e.g., no biometrics) | Feature hidden or explained; PIN still works |

---

## 10. API Architecture

### 10.1 MVP: no first-party API

The app makes no calls to any server owned by the project.

### 10.2 Google Drive integration (only remote API)

A single adapter in `lib/platform/googleDrive` exposes these operations: connect, disconnect, find or create the backup folder, list backups, upload a backup, and download a backup.

| Concern | Rule |
|---|---|
| Transport | Drive REST v3 over HTTPS with a bearer token |
| Timeouts | Every request has a timeout; long operations report progress steps (DESIGN §8.1) |
| Retries | Exponential backoff on 429 and 5xx, **only for idempotent operations** (list, download, folder lookup). Uploads are not retried blindly |
| Expired auth (401) | One silent token refresh, then a "reconnect Google" state |
| Offline | Detected before the call; immediate "unavailable" message; local use continues |
| Results | Typed success/failure values mapped to the error taxonomy (§14); the adapter never throws to the UI |
| Concurrency | Single-flight: one backup or restore at a time |

### 10.3 Native plugin contracts

Every plugin is reached through a platform adapter that:

- checks whether the capability exists before using it;
- returns a typed "unsupported" result in the browser development build instead of throwing;
- turns plugin errors into the shared error taxonomy.

### 10.4 Future: first-party API (not authorized)

Add a backend only if an approved requirement needs it, such as multi-device sync. Nothing in the workspace supports this today; it would be built from scratch, following this pattern:

- a contract-first API definition with generated, typed request/response validators;
- a server with its own database;
- versioned `/api/v1` paths;
- server-side verification of Google ID tokens;
- a conflict-resolution design for sync.

Prerequisites: ADR, privacy review, Data safety update, and owner approval.

---

## 11. External Services

| Service | Purpose | Data leaving the device | Required? | If unavailable | Status |
|---|---|---|---|---|---|
| Google Sign-In | Authorize Drive | Google account auth exchange | No | Local use continues | MVP |
| Google Drive API | Backup and restore | **Full backup file with financial data**, stored in the user's own Drive | No | Status line + retry; local data untouched | MVP |
| Firebase Crashlytics | Crash diagnostics | Stack traces, device/OS metadata. **No amounts, notes, merchants, category names, emails, or tokens** | No | Silent | MVP, **pending D9 privacy review** |
| Android share sheet + Filesystem | CSV and PNG export | Only what the user chooses to share | No | Visible error | MVP |
| Email / WhatsApp intents | User feedback | User-written message | No | Visible error | MVP |
| Google Play | Distribution and app signing | Store metadata | — | — | MVP |
| Google Fonts (runtime) | — | — | — | — | **Removed:** bundle fonts (DESIGN G7) |

No analytics, advertising, bank, payment, SMS, or AI services.

Crashlytics rules:

- Do not set a user ID from the Google email.
- Disclose Crashlytics accurately in the Data safety form.
- Whether users get an in-app opt-out is part of the D9 decision.

---

## 12. AI Architecture

**Not part of the MVP.** PRD §3 and §13 put AI assistants out of scope. "Analysis" means deterministic local rules in `lib/domain/` (breakdowns, safe-to-spend, projections, budget suggestions), with stated assumptions and "insufficient history" guards.

If AI is ever approved (Future), it must:

- be opt-in;
- prefer on-device processing;
- never send financial data to a third party without explicit consent and disclosure;
- leave deterministic domain calculations as the only source of numbers. AI could only explain or summarize them.

---

## 13. Environment Configuration

### 13.1 Environments

| Environment | How it runs | Purpose |
|---|---|---|
| Local web dev | `pnpm --filter @workspace/financial-clarity run dev` (Vite) | Fast UI iteration; native features return "unsupported" |
| Debug APK | `scripts/build-debug-apk.ps1` (Vite build → `cap sync android` → Gradle debug) | On-device testing |
| Release AAB | Vite production build → `cap sync android` → `gradlew bundleRelease` → signed with the upload key | Play Console tracks: internal → closed → production |

### 13.2 Configuration inventory

| Setting | Where | Secret? | Purpose |
|---|---|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | `.env.local` (gitignored) | No, public OAuth client ID | Browser-dev Google sign-in |
| `serverClientId` | `capacitor.config.ts` | No, public OAuth client ID | Android Google sign-in |
| `appId` `com.bytetobrain.fiscalfocus` | `capacitor.config.ts` | No | **Frozen** Android package identity |
| `google-services.json` | `android/app/` (gitignored) | Config, not a secret; kept out of the repo | Firebase/Crashlytics |
| Upload keystore + `keystore.properties` | Outside the repo (gitignored), backed up offline | **Yes** | Release signing; Play App Signing holds the app signing key |
| `versionCode` / `versionName` | `android/app/build.gradle` | No | Release versioning |
| `PORT`, `BASE_PATH`, `NODE_ENV` | Shell env for Vite | No | Dev server and asset base path |

### 13.3 Rules

- Anything prefixed `VITE_` is compiled into the public bundle. **Never put secrets in client configuration.** The MVP client needs no secrets.
- Configuration is fixed at build time. No remote config.
- Toolchain: Node 24, pnpm 10, Android SDK 36, and the JDK required by the Android Gradle Plugin. See [docs/BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md).
- **MVP-cleanup:** the app version recorded in backups is hard-coded to `1.0.0`. Take it from the build version instead.

---

## 14. Error Handling

### 14.1 Principles

1. Never report success before the data is durably saved or the remote operation has finished.
2. At storage and platform boundaries, errors are **returned as values**. Contexts turn them into user-facing messages.
3. Every message says **what happened, whether data is safe, and what to do next** (DESIGN §8).
4. Never swallow persistence errors. Never show NaN, ∞, or a percentage calculated from zero.

### 14.2 Error taxonomy

| Category | Example | Origin | Where the user sees it (DESIGN §8.2) | Reported to diagnostics? |
|---|---|---|---|---|
| Validation | Amount ≤ 0, missing category | Form | Inline under the field; values kept | No |
| Business rule | Delete a used category; overwrite budgets | Domain | Inline explanation or confirmation dialog | No |
| Persistence | Storage full, storage unavailable | Storage | Sheet banner or page banner; state unchanged | Yes (error code only) |
| Corrupt data | Invalid JSON at startup | Storage | Startup banner, or full-screen if core data is unreadable; raw data quarantined | Yes (key name + code) |
| Version | Backup from a newer app | Backup | Restore dialog: "Update the app" | No |
| Capability | No biometrics; running in browser | Platform | Explanation in place; rest of the screen still works | No |
| Authorization | Google consent denied or token expired | Platform | Settings row status + "Reconnect" | Yes (code only) |
| Network | Offline, timeout, 5xx | Drive | Persistent toast + status line + Retry | Yes (code only) |
| Export/share | Share sheet failure | Platform | Toast with reason | Yes (code only) |
| Unexpected | Render crash | Any | Full-screen fallback: "Your saved data is safe" + Reload | Yes (stack trace, scrubbed) |

### 14.3 Mechanics

- A top-level React error boundary, plus global handlers for errors and unhandled promise rejections, sends **scrubbed** reports to the crash reporter.
- Background operations (backup, recurring processing, CSV import) are single-flight and idempotent.
- Multi-key writes roll back on failure (§6.2).

### 14.4 Logging rules

- Release builds log no amounts, notes, merchant names, category names, emails, tokens, or backup contents.
- Diagnostic messages carry error codes and operation names, not user data.

---

## 15. Security Boundaries

### 15.1 Trust boundaries

| # | Boundary | Untrusted side | Controls |
|---|---|---|---|
| B1 | Person ↔ unlocked app | Someone holding the device | App lock; content not rendered while locked; background re-lock |
| B2 | App ↔ local storage | Stored data may be corrupt or old | Schema validation on read, migrations, quarantine |
| B3 | App ↔ imported files (backup JSON, CSV) | **File content** | Size limits, schema validation, version check, migration, preview, explicit confirmation; text rendered as text only (no raw HTML from data) |
| B4 | App ↔ Google | Network | TLS only; OAuth; `drive.file` least-privilege scope; tokens never stored by the app |
| B5 | App ↔ Crashlytics | Third party | Scrubbed payloads; disclosure; D9 review |
| B6 | App ↔ share targets | Destination app | User-initiated only; CSV formula escaping; label matches content |

### 15.2 Threat model

- **In scope:** casual physical access; a lost phone left unlocked; corrupted or malicious import files; overly broad permissions; leaking data through diagnostics; supply-chain compromise.
- **Out of scope (disclosed):** forensic extraction from rooted devices, because storage is not encrypted; a compromised Google account, which exposes Drive backups.

### 15.3 Controls

| Area | Control |
|---|---|
| Android permissions | `INTERNET`, `USE_BIOMETRIC`, `USE_FINGERPRINT` (API ≤ 28 only). **MVP-cleanup:** remove `READ_SMS` and verify the merged manifest of the release bundle |
| OS backup | Keep `allowBackup="false"` |
| WebView | Load bundled assets only; no remote pages; no cleartext traffic. Add a restrictive Content Security Policy allowing only `self` plus the Google API domains in use; verify it on a device |
| Rendering | No raw HTML injection of user or imported data |
| Secrets | None in source. Keystore and Firebase config are gitignored |
| Dependencies | `.npmrc` release-age gate, committed lockfile, pre-release dependency audit, removal of unused packages |
| Encryption at rest | **Deferred** (PRD FR-11, D7). The app says storage is not encrypted |
| Recents/screenshot privacy | **Owner decision 2026-11-06:** `FLAG_SECURE` is set while the app lock is enabled, so the app is blank in the recent-apps screen and screenshots are blocked. It is cleared when the lock is disabled |

---

## 16. Testing Strategy

### 16.1 Test layers

| Layer | Tool | Must cover |
|---|---|---|
| Static | `pnpm run typecheck`, `pnpm run build` | Whole workspace compiles and builds |
| Domain unit tests | Vitest | Every PRD §6 definition; period boundaries; recurring rules (31st → short months, Feb in leap and non-leap years, pause/resume skipping, catch-up after time away, **no duplicates on repeated runs**); used vs. unused category and inactive behavior; budget copy overwrite semantics; formatter; analysis guards (insufficient history, no NaN/∞) |
| Storage and migration | Vitest + jsdom | Quota failure leaves state unchanged and returns an error; corrupt data is quarantined; migrations are idempotent; v1/v2/v3 backup fixtures restore; newer backup is refused; legacy SMS keys survive |
| Component | React Testing Library | Entry sheet keeps values after a save failure; busy guard prevents double submit; Delete hidden for used categories; lock screen renders no financial content; destructive confirmations list the exact effects |
| Cross-screen consistency | Vitest | One fixture dataset → Dashboard, Budgets, Analysis, and Transactions selectors return identical values for the same period (PRD §14.2) |
| Device (manual) | Physical Android devices | PRD §14 checks; DESIGN §14 at default and 130% font size; TalkBack; keyboard-open forms; airplane-mode use; Drive recovery check; **upgrade install over the previous release keeps data** |
| Release artifact | Inspect the bundle | No SMS permission, SMS code, or SMS route in the release build; only expected permissions present |

- Test fixtures use synthetic data only. No real financial data in the repo.
- SMS tests are deleted together with the SMS code.

### 16.2 Continuous integration (MVP, minimal)

One GitHub Actions workflow on pull requests: install with frozen lockfile → typecheck → `vitest run` → web build. No device farm, preview environments, or deployment automation in the MVP.

---

## 17. Deployment

### 17.1 Release pipeline

1. Merge to `main` with CI green.
2. Bump `versionCode` (always increasing) and `versionName` (semantic version).
3. Production web build → `cap sync android` → `gradlew bundleRelease` → AAB signed with the upload key.
4. Upload to Play Console **internal testing**, then **closed testing** with the device checklist from §16.1, then a **staged production rollout**.
5. Watch crash reports. Halt the rollout if a critical problem appears.

### 17.2 Play Store readiness (PRD §14.10, D9)

- Data safety form matches §11 exactly: Drive backup (user-initiated, stored in the user's own Drive) and crash diagnostics.
- A privacy policy URL is published.
- The permissions list matches §15.3.
- The target API level meets current Play requirements (36).

### 17.3 Rollback

Google Play does not allow downgrades. **Fix forward**: halt the staged rollout and ship a patch. That is why migrations are forward-only and must never leave data unreadable by the current code (§8.4).

---

## 18. MVP vs. Future Scalability

| Area | MVP (now) | Future (trigger → approach) |
|---|---|---|
| Persistence | `localStorage` behind a storage adapter | Size or performance limit reached → SQLite through the same adapter interface (§8.7) |
| Backup | Existing Drive JSON backup, current coverage | Owner reopens D7 → encrypted backups, wider coverage, recovery redesign |
| Sync / multi-device | None | Approved requirement → contract-first API + server database + conflict resolution (§10.4) |
| Backend | None; no backend code in the workspace | Same trigger as sync; build new per §10.4 |
| Identity | Local lock + Google for Drive only | With a backend → server-verified Google ID tokens |
| Platforms | Android only | Approved iOS release → same codebase with the Capacitor iOS target |
| Analysis / AI | Deterministic local rules | Approved AI → opt-in, on-device first, explanations only (§12) |
| Diagnostics | Crashlytics, pending D9 | Opt-in toggle and stricter scrubbing based on D9 outcome |
| Money model | Positive rupee number + type | Precision or refund needs (D3) → integer paise through an ADR and a migration |
| Month-end review | Existing flow preserved | D8 resolved → redesign following this architecture |
| Security | App lock, unencrypted storage | Approved → encrypted storage (Android Keystore-backed key) and privacy screen |

---

## 19. MVP-Cleanup: Gaps Between Current Code and This Architecture

None of these items is authorized by this document alone. Each needs owner approval under the PRD's execution rule.

| ID | Gap in current code | Target | Source |
|---|---|---|---|
| A1 | SMS screens, parsers, native reader, route, and `READ_SMS` permission still present | Remove completely; keep legacy SMS keys readable for backups | PRD FR-10 |
| A2 | `saveToStorage` ignores errors; writes happen after state changes | Persist first, typed results, visible failures | PRD §9; §6.2 |
| A3 | **Partly resolved 2026-11-06:** deletion is blocked in the mutation for reserved categories and for categories used by transactions, budgets, or recurring rules (`lib/category-rules.ts`). Still missing: category active/inactive status | Domain-enforced usage rule, `active` flag, local migration, backup schema v4 | PRD FR-03 |
| A4 | Recurring rules lack D4 behavior | Occurrence identity, short-month clamp, skip paused months, idempotent catch-up | PRD FR-07; §6.4 |
| A5 | Two amount formatters; fonts loaded from Google at runtime | One formatter; bundled fonts | DESIGN G7, G8 |
| A6 | **Resolved 2026-11-06.** Removed the unused React Query provider, the `@workspace/api-client-react` dependency, 42 unused `components/ui` primitives, the unused `use-mobile` hook, and the 31 packages only they used | Remove | §2.3 |
| A7 | Backup app version hard-coded to `1.0.0` | Take it from the build version | §13.3 |
| A8 | **Resolved 2026-11-06.** While locked, `App.tsx` renders only the lock screen (no pages, sheets, FAB, navigation, or toasts) | Lock screen topmost; content not mounted while locked | DESIGN G12; §4.3 |
| A9 | Crash reporting not yet privacy-reviewed | Scrubbed payloads; disclosure; D9 decision | PRD FR-12 |
| A10 | `FinanceContext` mixes state, rules, and persistence (about 1,400 lines) | Split into `domain/` + `storage/`; same public hook API | §4.2 |
| A11 | No CI workflow | Minimal PR workflow | §16.2 |
| A12 | Pages and components re-sum transactions with their own filters (Dashboard "today's spend" counts card bill payments; the Transactions total counts savings and card payments) | Shared selectors for every displayed total; cross-screen consistency test | AGENTS §5; PRD §6 |
| A13 | Capacitor modules imported both statically and dynamically, so the dynamic imports split nothing | One import style per module | Audit 2026-06-28 |
| A14 | File names that break AGENTS §4 (`backupHash.ts`, `googleAuth.ts`, `googleDrive.ts`, `not-found.tsx`) | Rename when the file is next changed | AGENTS §3.2, §4 |
| A15 | Drive client logs the request URL and raw response body on errors | Log method, status, and Drive reason only | §14.4 |
| A16 | Single 1.2 MB JS chunk | Lazy-load heavy routes; measure on reference devices | PRD §14 |

Evidence, severity, and proposed approach for A2, A5, A7, A9, A10, and A12–A16 are in the review report [audits/2026-11-06-cleanup-phases-3-4-review.md](./audits/2026-11-06-cleanup-phases-3-4-review.md), pending owner review.

---

## 20. Governance

- **Precedence:** PRD.md governs scope, DESIGN.md governs UX, and this document governs structure. If any of them disagree with the code, report the gap; do not copy the code's behavior as the intended design.
- **Requires an ADR** (recorded by the App Oracle in `docs/knowledge-base/decisions/`) plus owner approval:
  - renaming storage keys or `appId`;
  - changing the backup schema;
  - adding Android permissions;
  - adding an external service or runtime dependency category;
  - introducing a backend, sync, AI, or a new money model.
- Only the App Oracle edits `docs/knowledge-base/`. Changes made under this architecture are handed to the Oracle for KB updates.
