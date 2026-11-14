# Fiscal Focus — API and Integration Contracts

**Version:** 1.0 (draft)
**Updated:** 2026-11-11
**Inputs:** [PRD.md](./PRD.md) v1.1, [ARCHITECTURE.md](./ARCHITECTURE.md) v1.0 (§6, §9, §10, §11, §13, §14, §15), [DATABASE.md](./DATABASE.md) v1.0, current source in `artifacts/financial-clarity/src/`
**Status:** Registered source of truth ([AGENTS.md](../AGENTS.md) §1.1, precedence in §1.3, 2026-11-11). It takes over the detailed contract content in ARCHITECTURE §10 and §11. Items labeled **Proposed** below still need owner confirmation before code uses them.

Labels used in this document:

| Label | Meaning |
|---|---|
| **Existing** | Behavior in the current source |
| **MVP-cleanup** | Target behavior the code must reach before release. This document does not authorize the work |
| **Proposed** | A convention or value this document introduces. The owner must confirm it before code uses it |
| **Pending review** | Blocked on an owner decision, for example D9 (privacy) |
| **Future** | Direction only. Needs an ADR and owner approval |

---

## 0. The API in One Paragraph

Fiscal Focus has **no first-party API, no backend, and no server endpoints** (PRD §10, ARCHITECTURE §5). The app talks to four kinds of interfaces:

1. **Internal contracts:** React context actions, the storage layer, and platform adapters, all inside one Android WebView.
2. **One remote API:** Google Drive REST v3, used for optional backups. Google Sign-In authorizes it.
3. **No diagnostics SDK.** Firebase Crashlytics was removed on 2026-11-12 (D9).
4. **User-started device intents:** the share sheet, email, and WhatsApp.

The app has no inbound endpoints and no webhooks. Every finance feature works when all network access is removed.

---

## 1. Scope and Principles

### 1.1 Allowed network destinations

Only these destinations are allowed. Adding one needs an ADR and owner approval (ARCHITECTURE §20).

| Destination | Purpose | Status |
|---|---|---|
| `accounts.google.com` and Google OAuth endpoints, called by the auth plugin and Play services | Google sign-in and token refresh for Drive | Existing |
| `https://www.googleapis.com/drive/v3` | Drive metadata: find, create, and patch files | Existing |
| `https://www.googleapis.com/upload/drive/v3` | Upload backup file content | Existing |
| `https://*.googleusercontent.com` (normally `lh3`) | Load the signed-in user's own Google profile photo (`imageUrl` from sign-in) as an image. No referrer, no app data. Other hosts and plain `http` are not loaded | **Approved 2026-11-14 (ADR-0011)** |
| Firebase Crashlytics endpoints | Crash diagnostics | **Removed 2026-11-12 (D9).** The app sends no diagnostics |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Runtime web fonts | **Removed 2026-11-12 (DESIGN G7).** Fonts are bundled locally |

The app never calls bank, payment, SMS, analytics, advertising, remote-config, or AI services (PRD §13).

### 1.2 Principles

| # | Principle | Source |
|---|---|---|
| P1 | **Offline first.** No core feature waits on the network | PRD §12 |
| P2 | **Typed results at boundaries.** Storage and platform adapters return `ok` or `error` values. They never throw to the UI | ARCHITECTURE §10.2, §14.1 |
| P3 | **Persist first.** Validate, apply domain rules, write storage, then update React state only if the write succeeded | ARCHITECTURE §6.2 |
| P4 | **Least privilege.** Drive scope is `drive.file`. The app adds no new Android permissions | ARCHITECTURE §9.3, §15.3 |
| P5 | **No secrets in the client.** The client needs none | ARCHITECTURE §13.3 |
| P6 | **Single-flight and idempotent** background work: backup, restore, recurring processing, and CSV import | ARCHITECTURE §14.3 |
| P7 | **Untrusted input is validated** at every boundary by the shared entity type guards | DATABASE §6.1 |
| P8 | **No sensitive data in logs or diagnostics** | DATABASE §9 |

---

## 2. Interface Map

| Caller | Interface | Callee | Transport |
|---|---|---|---|
| Pages and components | Context hooks: `useFinance`, `useSecurity`, `useBackup`, `useMonthEndReview`, `useFab` | Contexts | In-process function calls |
| `FinanceContext` | Storage layer (`writeFinanceData`, reads) | `localStorage` | Synchronous, in-process |
| `SecurityContext` | Security storage, biometric adapter, screen-security adapter | `localStorage`, native plugins | In-process and Capacitor bridge |
| `BackupContext` | `googleAuth` and `googleDrive` adapters, backup codec (`lib/backup.ts`) | Google Sign-In, Drive REST v3 | HTTPS with a bearer token |
| Backup and Restore, and Analysis pages | Export adapter (CSV and PNG) | Filesystem and Share plugins | Capacitor bridge, then Android intent |
| Feedback sheet | Feedback intents | Email and WhatsApp apps | `mailto:` and `https://wa.me/` intents |

Layer rule (ARCHITECTURE §4.1): pages and components never import `localStorage`, `@capacitor/*`, or Google modules. Only platform adapters call plugins or Google APIs.

---

## 3. Authentication and Authorization

### 3.1 Identity model

- The app has **no accounts**. There is one local user per installed dataset (PRD §8, DATABASE §1.3).
- Google sign-in **only authorizes Drive backup**. It is not a finance identity, and core features never need it.
- The app sends no ID tokens to any project-owned server, because no such server exists.

### 3.2 Where authorization is enforced

The instruction to "enforce authorization server-side" applies to the only server in the system, which is Google's.

| Asset | Enforcer | Mechanism |
|---|---|---|
| Drive backup files | **Google Drive servers** | OAuth 2.0 bearer token with the `drive.file` scope. Google allows access only to files this app created or the user opened with it |
| Local financial data | Android OS | App sandbox. `android:allowBackup="false"` |
| Rendering financial content | App (`SecurityContext` and the app shell) | Locked means not rendered (ARCHITECTURE §4.3) |
| Finance writes | App (`FinanceContext` plus domain rules) | The only writer of finance entities. Rules are enforced in mutations, not only by hiding UI |

Client-side checks protect the user experience and data integrity. **They are not a security boundary against someone with file-system access.** The UI discloses this (ARCHITECTURE §9.2).

### 3.3 App lock (local authorization)

| Aspect | Contract |
|---|---|
| PIN format | Exactly four digits (`^\d{4}$`). Checked before hashing |
| Storage | `pinHash` is SHA-256 of `salt:pin`, using WebCrypto. `pinSalt` is 16 random bytes. The PIN is never stored, logged, or exported |
| Verify | Hash the input with the stored salt and compare. Change or disable requires the current PIN |
| Biometric | Android BiometricPrompt through `@capgo/capacitor-native-biometric`. The plugin allows up to 3 attempts per prompt (`maxAttempts: 3`). The PIN is always the fallback |
| Cooldown | Every fifth consecutive failure starts a cooldown of 30 s, then 1 min, 5 min, and 15 min (maximum). The state is saved, so a restart does not reset it. PIN and biometric unlock are both refused during a cooldown. A success clears the count |
| Background lock | `appStateChange` starts a timer. The app locks on return after `lockTimeoutMs` (default 30 000 ms) |
| Screen privacy | `FLAG_SECURE` is on while the lock is enabled (owner decision, 2026-11-06) |
| Forgotten PIN | After an explicit warning, delete every `financial-clarity:` key. Remote backups are not touched |

### 3.4 Google OAuth

| Aspect | Contract |
|---|---|
| Library | `@codetrix-studio/capacitor-google-auth`, **pinned** at `3.4.0-rc.4` |
| Scopes | `profile`, `email`, `https://www.googleapis.com/auth/drive.file`. The app must not request any other scope |
| Clients | The **Web** OAuth client ID is used as `serverClientId` on Android and as `clientId` in browser development. One **Android** OAuth client must be registered for each signing key, using package `com.bytetobrain.fiscalfocus` and that key's SHA-1. This covers the debug key, the upload key, and the Play App Signing key |
| Client secret | **None.** The app never holds a client secret |
| Offline access | `grantOfflineAccess: true` and `forceCodeForRefreshToken: true`. The plugin stores the refresh token natively |
| Access token | Kept **in memory only**. It is reused for up to 50 minutes, then refreshed silently. It is never written to app storage or logs |
| Profile cache | `financial-clarity:google-user` holds `{ id, email, name, imageUrl? }` for display only. It is cleared on disconnect or when a silent refresh fails. Name and photo are read-only: the approved scopes cannot change them, so the Profile page tells the user to edit them in their Google account |
| Profile refresh | `refresh()` does not return profile data. "Refresh from Google" on Profile runs `GoogleAuth.signIn()` again, which returns the current name, email, and photo. No extra endpoint or scope is used |
| Account change | If sign-in returns a different Google account ID than the one connected, `BackupContext` clears the Drive folder cache and the remote backup info before using the new account, because both belong to the previous account |
| Cold start | A silent refresh runs once. If it fails, the app treats Google as disconnected and drops the profile cache |
| Disconnect | Sign out, clear the in-memory token, the profile cache, and the Drive folder cache. **Local records and remote backups are kept** (PRD FR-11). Local state is cleared even if the plugin's sign-out call fails |
| Consent screen | Move the OAuth consent screen from Testing to Production before the Play release. Verification needs for the scopes in use are part of **D9 (Pending review)** |

### 3.5 Authorization matrix

| Operation | Locked | Unlocked, local only | Unlocked, Google connected | Offline |
|---|---|---|---|---|
| View or edit finance data | ✗ | ✓ | ✓ | ✓ |
| PIN or biometric unlock | ✓ (subject to cooldown) | — | — | ✓ |
| Change or disable PIN | ✗ | ✓ with current PIN | ✓ with current PIN | ✓ |
| CSV import or export, image share | ✗ | ✓ | ✓ | ✓ (sharing may need network, depending on the target app) |
| Connect Google | ✗ | ✓ | — | ✗ ("You're offline") |
| Backup now, check, or restore | ✗ | ✗ (prompt to connect) | ✓ | ✗ (explain it is unavailable) |
| Auto-backup | ✗ | ✗ | ✓ if the conditions in §9.2 are met | Skipped silently |
| Forgotten-PIN reset | ✓ after warning | ✓ | ✓ | ✓ |

---

## 4. Conventions

### 4.1 Result envelope (Proposed)

Every fallible internal operation at a storage or platform boundary returns one of two shapes:

| Shape | Fields |
|---|---|
| Success | `ok: true`, plus the operation's value fields (for example `count`, `record`, `category`) |
| Failure | `ok: false`, `category` (taxonomy in §4.2), `code` (a stable string), `message` (user-safe text), `retryable` (boolean) |

Rules:

- `message` follows DESIGN §8. It says what happened, whether data is safe, and what to do next.
- `message` never contains amounts, notes, merchants, category names, emails, tokens, file contents, or raw server text.
- Diagnostics receive `category` and `code` only.

Existing shapes must converge on this envelope (**MVP-cleanup**):

| Existing shape | Location | Difference from the envelope |
|---|---|---|
| `StorageWriteResult`: `{ ok: false, error: 'quota' \| 'unavailable', message }` | `lib/storage/finance-storage.ts`, also returned by `applyBackup` | Uses `error` where the envelope uses `code` |
| `MigrationResult` and `FinanceReadResult`: `{ ok: false, error }` | `lib/storage/migrations.ts`, `lib/storage/finance-read.ts` | Uses `error` where the envelope uses `code`; `App` maps them to startup messages |
| `FinanceWriteResult`: `{ ok: false, message }` | `FinanceContext` | Has no code |
| `ScreenSecurityResult`: `{ ok: false, reason: 'unsupported' \| 'failed' }` | `lib/screen-security.ts` | Uses `reason` where the envelope uses `code` |
| `ValidationResult`: `{ ok: false, reason, errors[] }` | `lib/backup.ts` | Uses `reason` and `errors` |
| `Promise<boolean>` | `SecurityContext` actions, biometric adapter | Has no reason at all |
| Thrown `DriveError` and `Error` | `googleDrive`, `googleAuth`, `BackupContext` | Throws instead of returning a value |

### 4.2 Error taxonomy and codes

The categories come from ARCHITECTURE §14.2. The codes are **Proposed**.

| Category | Codes | Origin | Retryable | Sent to diagnostics |
|---|---|---|---|---|
| `validation` | `validation.amount`, `validation.date`, `validation.category`, `validation.pin_format`, `validation.required` | Forms, CSV rows | No | No |
| `business_rule` | `rule.category_in_use`, `rule.category_reserved`, `rule.budget_exists`, `rule.duplicate_name` | Domain | No | No |
| `persistence` | `storage.quota`, `storage.unavailable` | Storage | After the user acts | Yes, code only |
| `corrupt_data` | `storage.corrupt` (with key name), `backup.invalid_shape`, `backup.invalid_data`, `backup.migration_failed`, `csv.missing_columns` | Storage, backup, CSV | No | Yes, code and key name only |
| `version` | `backup.newer_version` | Backup | No ("Update the app") | No |
| `capability` | `platform.unsupported`, `biometric.unavailable`, `biometric.not_enrolled` | Platform | No | No |
| `authorization` | `auth.cancelled`, `auth.expired`, `auth.permission_removed`, `auth.wrong_pin`, `auth.cooldown` | Platform, Security | User reconnects, retries, or waits | Yes, code only (except `auth.cancelled` and `auth.wrong_pin`) |
| `network` | `net.offline`, `net.timeout`, `net.rate_limited`, `net.server` | Drive | Yes (§9.3) | Yes, code only |
| `remote_state` | `drive.not_found`, `drive.quota_exceeded`, `backup.would_shrink`, `backup.remote_unreadable`, `backup.snapshot_failed` | Drive, backup | No; needs user action or confirmation | Yes, code only |
| `export` | `export.share_failed`, `export.write_failed` | Platform | Yes | Yes, code only |
| `unexpected` | `unexpected` | Any | Reload | Yes, scrubbed stack |

A user cancelling (for example closing the Google account picker or the share sheet) is **not an error**. Return to idle without showing an error.

### 4.3 Validation conventions

| Boundary | Validator | On failure |
|---|---|---|
| Form submit or blur | Shared entity type guard plus the field rules in DATABASE §6.2 | Inline error. Keep the entered values |
| Storage read at startup | Same entity type guard | Quarantine the raw text to `financial-clarity:backup:<key>:<epoch_ms>`. Never drop it silently |
| Backup file (Drive download) | `validateBackup`: shape, version, then migrate, then validate every record | Refuse the whole file. Local data is unchanged |
| CSV file | Size of 5 MB or less, then required headers, then per-row rules, then a duplicate plan | Reject the file, or show a preview that counts invalid rows by line number |
| Plugin results | Check the capability, then narrow `unknown` results | `platform.unsupported` or a mapped error |
| Drive responses | Check the HTTP status, then parse JSON as `unknown` and narrow the fields used (`id`, `name`, `modifiedTime`, `size`, `appProperties`) | Mapped error (§6.2.5) |

Rules:

- There is **one validator per entity**, shared by forms, storage, backup, and CSV (DATABASE §6.1). No schema library.
- Reject values that are not finite numbers or not valid calendar dates. Never coerce them silently.
- Render imported text as plain text. Never render it as HTML.

### 4.4 Data formats

| Logical type | Wire format | Rule |
|---|---|---|
| Money | JSON number | Positive, finite rupees. The transaction type gives the direction. Maximum 1 000 000 000 |
| Signed money | JSON number | Reconciliation balances only |
| Date | `YYYY-MM-DD` | Local calendar date, and must be a real date |
| Month | `YYYY-MM` | Local calendar month |
| Event time, local | `epoch_ms` | Do not convert existing values |
| Event time, backup envelope | ISO-8601 UTC (`…Z`) | Do not convert existing values |
| IDs | Non-empty string | Generated on the device, never reused or rewritten |
| Text encoding | UTF-8 JSON | Field names use camelCase |
| CSV | UTF-8. A leading BOM is accepted on import | See §6.5 |

### 4.5 Concurrency and idempotency

| Operation | Guard |
|---|---|
| Backup, restore, and remote check | One at a time. `BackupContext.status` must be `idle` to start |
| Auto-backup | A running flag, the hash skip, and the rules in §9.2 |
| Recurring processing | Single-flight. The occurrence key `(recurringRuleId, recurringMonth)` makes it idempotent |
| CSV import | One all-or-nothing `importTransactions` commit. The duplicate plan makes a re-import add nothing new |
| Submit buttons | Go busy at once and ignore repeated taps |

---

## 5. Internal APIs

### 5.1 Storage layer

**Owner:** `src/lib/storage/`. It is the **only** code that reads or writes finance keys. Every key name lives in `lib/storage/keys.ts` (G17 resolved 2026-11-11). **MVP-cleanup:** the non-finance modules (security settings, onboarding flags, month-end review state, Google profile cache, backup preferences) still call `localStorage` directly for their own keys.

| Operation | Input | Success | Failure | Notes |
|---|---|---|---|---|
| `prepareStorage()` | — | `{ ok: true, load }` with the finance data and a quarantine report | `{ ok: false, problem }`: `unavailable`, `storage-full`, `newer-version`, `migration-failed`, or `unpreserved` (with the load) | Runs at startup before any provider mounts: migrations first, then the finance read (ARCHITECTURE §6.1). `App` shows a full-screen explanation for any problem |
| `runLocalMigrations()` | Registered steps | `{ ok: true, version, applied }` | `{ ok: false, error, version? }`: `unavailable`, `quota`, `invalid-version`, `newer-version`, `migration-failed` | Ordered, forward-only, idempotent. Each step writes its data and then `storage-version` in one rolled-back unit (DATABASE §10.1) |
| `readFinanceData({ quarantine })` | Whether to copy invalid raw text to quarantine (default yes) | `{ ok: true, data, quarantined }`. Each report has `key`, `invalidCount` (`null` if the whole key was unreadable), and `preserved` | `{ ok: false, error: 'unavailable' }` | Uses the shared entity validators (`lib/storage/schemas.ts`). An identical quarantine copy is not saved twice. Backup building reads with `quarantine: false` |
| `writeFinanceData(changes)` | A partial map of finance keys to values | `{ ok: true }` | `storage.quota` or `storage.unavailable`. Every key is rolled back | Fixed write order: categories, transactions, reconciliations, recurring, budgets, savingsGoal (DATABASE §7.3) |
| `writeStorageEntries(entries)` | Ordered `[key, value]` pairs. `undefined` removes the key | `{ ok: true }` | As above | Snapshots, writes, and rolls back in reverse order |
| Apply restore (`applyBackup`) | A validated backup | `{ ok: true, counts }` | The `StorageWriteResult` failure. Every key is rolled back | Uses `writeStorageEntries`. `BackupContext` shows the failure message and does not reload |

Storage keys are frozen. The full catalogue is in DATABASE §3.

### 5.2 `FinanceContext` (the only writer of finance entities)

| Action | Input | Success | Failure |
|---|---|---|---|
| `addTransaction` / `updateTransaction` | A transaction without `id` (plus `id` for update) | `{ ok: true }` | `{ ok: false, message }` |
| `deleteTransaction` | `id` | `{ ok: true }` | As above |
| `importTransactions` | Items, plus optional new categories | `{ ok: true, count }` | As above. Nothing is saved |
| `addCategory` | A category without `id` | `{ ok: true, category }` | As above |
| `setCategoryActive` | `id`, `active` | `{ ok: true }` | Refused for built-in categories, or a storage failure. New transactions, new budgets, and new or edited recurring rules are refused in an inactive category |
| `updateCategory` / `deleteCategory` | `id`, plus updates for update | `{ ok: true }` | A delete check result (in use or reserved) or a storage failure |
| `addBudget` / `updateBudget` / `deleteBudget` | A budget, or `id` and `limit` | `{ ok: true }` | As above |
| `transferBudgetsToMonth` | `fromMonth`, `toMonth` | `{ ok: true, count }` | As above. Copies limits only; it never moves money (PRD §6) |
| `addRecurring` / `updateRecurring` / `deleteRecurring` / `toggleRecurringActive` | A rule or `id` | `{ ok: true }` | As above. The cursor never moves back |
| `setSavingsGoal` | Both buckets | `{ ok: true }` | As above |
| `addReconciliation` | `month`, bank `actualBalance`, `expectedBalance`, optional `adjustmentAmount`, `note`, and combined `savings` actual balance and decrease reason | `{ ok: true, record }` | As above; validates stale figures and commits corrections and record together |
| `recordCardBillPayment` | `month`, `amount` (month-end Card bill step) | `{ ok: true }`. Saves an expense with `paymentMethod: 'credit-card-payment'`, category `other`, note "Card bill payment", dated the month's last day | `{ ok: false, message }` for a non-positive amount, more than `getCardBillPaymentLimit` allows on that date, or a storage failure. Nothing is saved |
| `recordCardBillPaymentOn` | `date` (`YYYY-MM-DD`), `amount` (Dashboard card sheet) | As above, dated `date` | As above, plus an invalid or future date |
| `reloadFromStorage` | — (used after a restore) | State is re-read | If storage can't be read, state is unchanged and `storageError` is set |
| `processRecurring` | — (called by `App.tsx` after unlock and on resume) | `{ ok: true, count }` — occurrences added | `{ ok: false, message }` and `storageError`; nothing is saved and cursors do not move |

**Read API (selectors).** `getMonthSummary`, `getTotalIncome`, `getTotalExpenses`, `getTotalSavings`, `getTotalCommitments`, `getTotalDayToDay`, `getCarryForward`, `getNetBalanceToDate`, `getCumulativeNetBalanceThroughEndOf`, `getOutstandingCardBalance`, `getOutstandingCardBalanceAtEndOf`, `getCardBillPaymentsIn`, `getCardBillPaymentsAfter`, `getCardBillPaymentLimit`, `getExpectedBankBalanceAtEndOf`, `getSavingsBalanceAtEndOf`, `getBudgetBreakdown`, `getSpentForCategory`, and `getReconciliationFor`. Each PRD §6 metric has **exactly one** implementation. Pages never re-sum transactions.

`getBudgetBreakdown(month)` returns the shared budget summary (`lib/domain/budgets.ts` `budgetSummary`) used by both Budgets and Analysis: `dayToDay`, `commitments`, and `savings`, each with `limit`, `spent` (against budgeted categories), `unbudgeted` (spending in that type's categories without a budget), and `count`. `getCardBillPaymentLimit(date)` is the smaller of the amount unpaid on `date` and the amount unpaid now, so a bill payment recorded on a later date is never recorded again at month end.

**Signals.** `lastChangedAt` is bumped on every mutation and drives the auto-backup debounce. `storageError` is set when a background save fails (for example during recurring generation).

### 5.3 `SecurityContext`

| Action | Input | Current return | Target return (**MVP-cleanup**) |
|---|---|---|---|
| `setupPin` | `pin` | `boolean` | Result with `validation.pin_format` or `storage.*` |
| `changePin` / `disableAppLock` | Current PIN (plus the new PIN for change) | `boolean` | Result with `auth.wrong_pin`, `auth.cooldown`, or `storage.*` |
| `unlockWithPin` | `pin` | `boolean` | Result with `auth.wrong_pin` (including attempts left) or `auth.cooldown` (including `cooldownUntil`) |
| `unlockWithBiometric` | — | `boolean` | Result with `biometric.*` or `auth.cooldown` |
| `enableBiometric` / `disableBiometric` / `openBiometricEnrollment` | — | `boolean` or void | Result with a `capability` code |
| `lockNow` | — | void | void |
| `resetAllData` | — | void | Result. Only after the explicit warning |

### 5.4 `BackupContext`

| Action | Input | Success | Failure |
|---|---|---|---|
| `signIn` | — | `GoogleUser` | Cancellation returns to idle with no error UI. Other failures map to an `auth` code |
| `signOut` | — | void | It always clears the local session state |
| `checkRemoteBackup` | — | `RemoteBackupInfo` or `null` | Mapped Drive error |
| `backupNow` | `{ replaceLargerBackup? }` | `{ status: 'done', counts }`, or `{ status: 'needs-confirmation', remoteTransactions, localTransactions, remoteExportedAt? }` | Mapped Drive or backup error |
| `restoreFromDrive` | Optional `RemoteBackupInfo` | `BackupCounts` | `backup.newer_version`, `backup.invalid_*`, or a mapped Drive error |
| `setAutoBackupEnabled` | `boolean` | void | — |
| `clearError` | — | void | — |

Status values are `idle`, `signing-in`, `checking`, `backing-up`, `restoring`, and `error`. Each action **throws today**. **MVP-cleanup:** each action must return the result envelope instead.

### 5.5 Other contexts

| Context | Contract |
|---|---|
| `MonthEndReviewContext` | `pendingMonth`, `pendingState`, `isOpen`, `open`, `dismiss`, `skip`, `complete`, `suppressAutoOpen`. It writes only `financial-clarity:month-end-review:<YYYY-MM>`. Never shown over the lock screen, onboarding, or an open sheet |
| `FabContext` | `fabAction`, `setFabAction`. UI registration only, with no persistence |

### 5.6 Platform adapters

Every adapter checks that its capability exists. In the browser it returns `platform.unsupported` instead of throwing (ARCHITECTURE §10.3).

| Adapter | Operations | Browser behavior |
|---|---|---|
| `googleAuth` | `initGoogleAuth`, `signIn`, `signOut`, `trySilentRefresh`, `getAccessToken({ forceRefresh })`, `getCurrentUser`, `isSignedIn` | Uses `VITE_GOOGLE_WEB_CLIENT_ID` |
| `googleDrive` | `findOrCreateBackupFolder`, `findBackupFile`, `downloadBackup`, `uploadBackup`, `uploadSnapshot` | Same calls over HTTPS |
| `biometric` | `getBiometricAvailability`, `verifyBiometric`, `addBiometryChangeListener`, `openBiometricEnrollmentSettings` | Reports "not available" |
| `screen-security` | `setScreenSecure(enabled)` | `unsupported` |
| Export | `exportCsvFile(filename, csv)`, Analysis PNG share | Browser download |
| Feedback | Open `mailto:` or `https://wa.me/<number>?text=` | Opens a new tab or the mail client |
| App lifecycle | `appStateChange` and back-button listeners | Listener unavailable; ignored |

---

## 6. External APIs and Integrations

### 6.1 Google Sign-In

| Operation | Plugin call | Result |
|---|---|---|
| Initialize | `GoogleAuth.initialize({ scopes, grantOfflineAccess, clientId? })` | Runs once. A failure surfaces on the next sign-in |
| Sign in | `GoogleAuth.signIn()` | User profile and access token |
| Refresh | `GoogleAuth.refresh()` | New access token. No profile is returned |
| Sign out | `GoogleAuth.signOut()` | Local state is always cleared |

Known failure: Android status code `10` means the APK's SHA-1 is not registered, or the account is not a test user while the consent screen is in Testing ([BUILD_ON_HOME_PC.md](./BUILD_ON_HOME_PC.md) §5). Map it to `auth.permission_removed` and show "Reconnect". Do not show the raw code to the user.

### 6.2 Google Drive REST v3

#### 6.2.1 Remote objects (frozen names)

| Object | Name | Notes |
|---|---|---|
| Backup folder | `Finance Clarity Backups` | Created by the app in the user's My Drive |
| Canonical backup | `finance-clarity-backup.json` | One file, updated in place |
| Pre-overwrite copy | `finance-clarity-backup.pre-overwrite-<timestamp>.json` | Made before a confirmed replacement of a larger or unreadable backup. The timestamp is ISO-8601 with `:` and `.` replaced by `-` |
| Pre-restore copy | `finance-clarity-backup.pre-restore-<timestamp>.json` | Made before a restore, best effort |

Like the storage prefix, these names are **frozen** and are not rebranded. The user keeps or deletes the copies; the app never deletes Drive files.

#### 6.2.2 Common request rules

| Rule | Value |
|---|---|
| Transport | HTTPS only |
| Auth header | `Authorization: Bearer <access token>` from `getAccessToken()` |
| Field projection | Always send `fields=` so the response holds only the fields the app uses |
| Body encoding | JSON for metadata. `multipart/related` for create with content. `application/json` media for content update |
| Timeout | **Proposed:** 15 s for metadata calls and 60 s for upload or download (**MVP-cleanup**; there are no timeouts today) |

#### 6.2.3 Endpoints

| ID | Purpose | Method and path | Key parameters or body | Response fields used | Idempotent | Retried |
|---|---|---|---|---|---|---|
| D1 | Find the backup folder | `GET /drive/v3/files` | `q`: name is the folder name, mimeType is `application/vnd.google-apps.folder`, `trashed=false`. Also `spaces=drive`, `pageSize=10`, `fields=files(id,name)` | `files[].id` | Yes | Yes |
| D2 | Create the backup folder | `POST /drive/v3/files` | Body: `name`, `mimeType` (folder) | `id` | **No** | No. Run D1 again first |
| D3 | Find the canonical backup | `GET /drive/v3/files` | `q`: name is `finance-clarity-backup.json`, `'<folderId>' in parents`, `trashed=false`. `fields=files(id,name,modifiedTime,size,appProperties)` | `id`, `modifiedTime`, `size`, `appProperties` | Yes | Yes |
| D4 | Download a backup | `GET /drive/v3/files/{fileId}?alt=media` | — | Raw JSON text | Yes | Yes |
| D5 | Create the canonical backup | `POST /upload/drive/v3/files?uploadType=multipart` | Part 1 metadata: `name`, `parents`, `mimeType=application/json`, `appProperties`. Part 2: the backup JSON | `id`, `name`, `modifiedTime`, `size`, `appProperties` | **No** | No |
| D6 | Update backup metadata | `PATCH /drive/v3/files/{fileId}` | Body: `appProperties` | — | Yes | Yes |
| D7 | Update backup content | `PATCH /upload/drive/v3/files/{fileId}?uploadType=media` | Body: the backup JSON | As D5 | Yes (same bytes) | **No blind retry.** Re-check D3 first |
| D8 | Upload a safety copy | `POST /upload/drive/v3/files?uploadType=multipart` | Metadata: unique `name`, `parents`, `mimeType`. Content: the snapshot JSON | `id`, `name`, `modifiedTime`, `size` | **No** | No |

**MVP-cleanup for D6 and D7.** Today, metadata (D6) is patched **before** content (D7). If D7 fails, `appProperties` describe content that was never uploaded, and the shrink guard in §6.4 can misjudge the next backup. The target is one `PATCH /upload/drive/v3/files/{fileId}?uploadType=multipart` carrying both metadata and content. Failing that, upload the content first and patch the metadata second.

#### 6.2.4 `appProperties` schema

These values are private to the app and limited to 124 bytes per key and value in UTF-8. The app clamps each pair to 120 bytes and leaves out empty values.

| Key | Value |
|---|---|
| `schemaVersion` | Backup schema version, for example `6` |
| `appVersion` | App version string |
| `exportedAt` | ISO-8601 UTC time |
| `devicePlatform`, `deviceModel` | Platform and a shortened user-agent string |
| `countTransactions`, `countCategories`, `countBudgets`, `countRecurring`, `countSavings` | Integer strings |
| `countPendingSms`, `countDismissedSms`, `countLinkedSms` | Legacy integer strings, kept for compatibility |

`appProperties` must never contain amounts, notes, merchants, category names, or emails.

#### 6.2.5 Mapping Drive responses to errors

Drive error bodies contain `error.code`, `error.message`, and `error.errors[0].reason`. The app reads the `reason` value. It never shows `error.message` to the user or stores it.

| HTTP status | `reason` | Code | Action |
|---|---|---|---|
| Network failure before a response, or `navigator.onLine === false` | — | `net.offline` | Stop. Show that Drive is unavailable. Local use continues |
| No response before the timeout | — | `net.timeout` | Retry only if idempotent |
| 401 | — | First force one token refresh and retry once. If it fails again: `auth.expired` | Show "Reconnect Google" |
| 403 | `insufficientPermissions`, `appNotAuthorizedToFile` | `auth.permission_removed` | Show "Reconnect Google" |
| 403 | `storageQuotaExceeded` | `drive.quota_exceeded` | "Your Google Drive is full" |
| 403 or 429 | `userRateLimitExceeded`, `rateLimitExceeded` | `net.rate_limited` | Back off (§9.3) |
| 404 | — | `drive.not_found` | Clear the folder cache, then look it up again once |
| 5xx | — | `net.server` | Back off if idempotent |
| Any other status | — | `unexpected` | Generic message |

**MVP-cleanup:** today a 403 rate-limit response is shown as "Permission was removed". Map it to `net.rate_limited` instead.

### 6.3 Backup file contract

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | int | Currently `6` (v6 adds savings-correction transaction metadata, ADR 0008). If it is newer than supported, refuse with `backup.newer_version` |
| `appVersion` | string | The app's build version (`package.json` → Vite `__APP_VERSION__`) since 2026-11-12. Older backups say `1.0.0` |
| `exportedAt` | ISO-8601 UTC | — |
| `device` | `{ platform, model?, osVersion? }` | Not used for any decision |
| `counts` | Integer counts per collection, plus legacy SMS counts | Used for the preview and the shrink guard |
| `data.transactions` | Array of transactions | Each one passes `isValidTransaction` |
| `data.categories` | Array | `isValidCategory` |
| `data.budgets` | Array | `isValidBudget` |
| `data.recurringExpenses` | Array | `isValidRecurring` |
| `data.savingsGoal` | Object or `null` | `isValidSavingsGoal` |
| `data.sms` | Legacy block | Must be present and well formed. It **never** reactivates SMS features |

Versioning follows DATABASE §10.2: v1 → v2 → v3 → v4 → v5 → v6 step by step. The data-block hash is SHA-256 of the serialized `data` block, ignoring `exportedAt`. Auto-backup uses it to skip unchanged data.

**Excluded from backups** (this is disclosed to users): reconciliations, review state, onboarding, lock settings, the Google session, backup preferences, caches, and quarantine keys.

**Size guard (Proposed, MVP-cleanup):** before D4, refuse a download whose `size` exceeds the local storage budget of about 5 MB (DATABASE §1.1), with `backup.invalid_shape`.

### 6.4 Backup and restore flows

**Backup now (manual or automatic):**

1. Check that the user is signed in and online.
2. Find the folder from the cache, or with D1 then D2.
3. Find the canonical backup with D3.
4. Build the backup from validated local data.
5. **Shrink guard.** If a remote backup exists, read its `countTransactions`. If that count is missing, download the file (D4) and count the transactions. If the remote file is unreadable, or has more transactions than this device:
   - **Manual backup:** return `needs-confirmation`. After the user confirms, save the remote file with D8 (pre-overwrite copy). If that copy fails, stop with `backup.snapshot_failed` and leave Drive unchanged.
   - **Automatic backup:** never replace the file. Record the paused notice.
6. Upload with D5 (new file) or D6 and D7 (existing file).
7. Record `lastBackupAt` and `lastBackupHash`, and clear the auto-backup error.

**Restore:**

1. Find the folder and the file (D1 and D3). If there is none, return `drive.not_found`.
2. Show a preview of the remote metadata. The user confirms that it will replace local data.
3. Upload a pre-restore copy of local data with D8 (best effort; see §13).
4. Download the backup (D4), then parse, migrate, and validate it. Any failure leaves local data unchanged.
5. Apply it atomically: snapshot, write, and roll back on any failure. Then call `reloadFromStorage`.
6. Record `lastBackupAt` and `lastBackupHash`.

### 6.5 CSV exchange

| Aspect | Contract |
|---|---|
| Columns | `Date, Category, Amount, Note, Type, Savings correction`. On import, header names are matched without regard to case. `Note` and `Savings correction` are optional |
| Export cell encoding | Every cell is quoted, and `"` becomes `""`. Cells starting with `=`, `+`, `-`, `@`, tab, or carriage return get a `'` prefix |
| Import unguarding | A leading `'` before a formula trigger is removed, so a round trip keeps the original text |
| Import limits | 5 MB file maximum. `Amount` must match `^\d+(\.\d+)?$` and be greater than 0. `Date` must be a valid `YYYY-MM-DD` date. `Type` must be `income` or `expense` |
| Savings corrections | Exported with their correction kind; import reports those rows as invalid and directs the user to a full backup rather than treating them as ordinary transactions |
| Duplicate rule | Same date, type, amount (2 decimal places), category, and note. Repeat counts are respected |
| New categories | Created only for rows that are actually imported, in the same all-or-nothing commit |
| Report | Imported, duplicate, and invalid counts. Invalid rows are listed by line number |
| Disclosure | CSV is **not** a full backup |
| Transport | Written to the app cache `exports/` folder, then shared through the system share sheet. Only the user picks the destination |

### 6.6 Image export

The app renders the Analysis Overview to a PNG with html-to-image, writes it to the app cache, and opens the share sheet through the platform adapter `lib/platform/share-image.ts`. Since 2026-11-12 (DESIGN G16) a failure shows a "Couldn't share the image" toast (`export.share_failed`); closing the share sheet is a cancellation and shows nothing.

### 6.7 Firebase Crashlytics (Removed 2026-11-12, D9)

The owner decided to remove crash reporting. The `@capacitor-firebase/app` and `@capacitor-firebase/crashlytics` packages, the `crashlytics.ts` module, its start-up call, the Crashlytics Gradle plugin, and the Capacitor module links were removed. `src/__tests__/crash-reporting-removed.test.ts` fails if any of them return. Adding diagnostics back needs a new owner decision, an ADR, scrubbing rules, and a Data safety update.

### 6.8 Feedback intents

These open only when the user taps them. The prefilled text is static, and the app attaches no data automatically. The support email and WhatsApp number are public contact details, not secrets.

---

## 7. Pagination and Filtering

| Area | Approach |
|---|---|
| Internal data | **No pagination.** Collections are loaded once and indexed in memory by memoized selectors (DATABASE §7). The Transactions screen filters by type, date range, and category, note, or amount search, using linear scans over in-memory data. This is enough for one user at current data sizes |
| Period filtering | Every month or period filter uses the shared month-boundary helpers. Screens never compute their own boundaries |
| CSV export | Exports the records the user selected. The file label must match the records actually included |
| Drive lookups (D1, D3) | Exact-name `q` filters, plus a parent filter and `trashed=false`. `fields` projection. `pageSize=10` |
| Drive ordering | **MVP-cleanup:** add `orderBy=modifiedTime desc` to D3, so that if several files share the canonical name the newest one is used every time. Today the order is unspecified |
| Drive paging | `nextPageToken` is not followed. That is acceptable only because lookups are exact-name and the app expects one file. Listing safety copies is **not** in scope (PRD FR-11, D7). If it is ever approved, follow `nextPageToken` and do not raise `pageSize` |

---

## 8. Webhooks and Verification

| Topic | Contract |
|---|---|
| Inbound webhooks | **None.** The app exposes no HTTP endpoint |
| Drive push notifications (`changes.watch`, `files.watch`) | **Not used.** They need a public HTTPS receiver, which would be a backend (PRD §10) |
| Deep links and app links | **None registered.** The manifest declares only `MAIN` and `LAUNCHER`. OAuth returns through the plugin and Play services, not through a custom URL scheme |
| OAuth caller verification | Google checks the package name and signing-certificate SHA-1 against the registered Android OAuth client. Every signing key in use must be registered |
| Inbound data verification | Backup files and CSV files are untrusted. Each goes through the size, schema, version, and preview checks, then explicit confirmation (§4.3) |
| Future webhooks | Need an ADR, a backend, HTTPS, verification of the sender's channel token or signature, replay protection, idempotent handlers, and server-side authorization of every event |

---

## 9. Rate Limiting and Quotas

### 9.1 External limits

| Service | Limit | Handling |
|---|---|---|
| Google Drive API | Per-project and per-user request quotas set in Google Cloud, returned as 403 with a rate-limit reason or as 429 | `net.rate_limited` with backoff (§9.3). The app's call volume is far below normal quotas |
| Drive storage | The user's Google storage quota | `drive.quota_exceeded`. No retry |
| `appProperties` | 124 bytes per key and value | Clamped to 120 bytes |

### 9.2 App-side throttling (Existing)

| Control | Value |
|---|---|
| Auto-backup interval | At most once every 7 days |
| Debounce after a data change | 30 s |
| Other triggers | When the app returns to the foreground |
| Skip conditions | Disabled by the user, not signed in, offline, another operation running, no successful manual backup yet, or data hash unchanged (the clock is reset without uploading) |
| Single-flight | One backup or restore at a time |
| Manual actions | Buttons go busy and ignore repeated taps |
| PIN attempts | Cooldown ladder of 30 s, 1 min, 5 min, then 15 min, saved across restarts |
| Biometric prompt | Up to 3 attempts per prompt (plugin) |

### 9.3 Retry policy (Proposed, MVP-cleanup)

| Rule | Value |
|---|---|
| Eligible calls | Idempotent only: D1, D3, D4, D6 |
| Never auto-retried | D2, D5, D7, D8. Re-check the remote state (D1 or D3) before the user retries |
| Trigger | `net.timeout`, `net.rate_limited`, `net.server` |
| Schedule | Up to 3 attempts in total, with exponential backoff of 1 s, then 2 s, then 4 s, plus random jitter of up to 500 ms. Honor `Retry-After` when present |
| 401 | One forced token refresh, then retry once. This is separate from the backoff budget |
| After retries run out | Return a typed error. Auto-backup records a failure category, and manual actions show Retry |

---

## 10. Required Environment and Configuration

| Name | Where | Used by | Secret | Required |
|---|---|---|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | `artifacts/financial-clarity/.env.local` or `.env` (gitignored). Template in `.env.example` | Browser development sign-in | **No.** It is a public OAuth client ID compiled into the bundle | Browser development only |
| `serverClientId` | `capacitor.config.ts` | Android sign-in | No (public Web client ID) | Yes, on Android |
| `server_client_id` | `android/app/src/main/res/values/strings.xml` | Android sign-in plugin | No | Yes. Must equal `serverClientId` |
| Android OAuth clients (package and SHA-1) | Google Cloud Console | Google verification of the caller | No | One per signing key: debug, upload, and Play App Signing |
| `google-services.json` | `android/app/` (gitignored) | Google services Gradle plugin (no Firebase SDK since D9) | Configuration, kept out of the repo | Optional |
| Upload keystore and `keystore.properties` | Outside the repo (gitignored), with an offline backup | Release signing | **Yes** | Release builds only. Never enters the app bundle |
| `versionCode` and `versionName` | `android/app/build.gradle` | Release versioning, and the backup `appVersion` (MVP-cleanup) | No | Yes |
| `PORT`, `BASE_PATH`, `NODE_ENV` | Shell environment for Vite | Development server and asset base path | No | Development and build |

Rules:

- Anything prefixed `VITE_` is public. **No secret may ever use that prefix**, and the client needs no secret at all. A Google **client secret** must never appear in the repo, the bundle, or `.env*` files.
- Configuration is fixed at build time. There is no remote config.
- Never commit `.env*` files with real values, keystores, `keystore.properties`, or `google-services.json`.

---

## 11. Data Privacy

### 11.1 Data leaving the device

| Destination | Data | Trigger | User control | Disclosure |
|---|---|---|---|---|
| User's own Google Drive | **Full backup with financial data**, unencrypted, plus `appProperties` holding counts and device information | Manual backup, or auto-backup after one successful manual backup | Connect or disconnect, auto-backup toggle | In-app text and the Data safety form |
| Google OAuth | Account authentication exchange | Connect or refresh | Connect or disconnect | Data safety form |
| Google profile-photo host (`*.googleusercontent.com`) | An image request for the user's own photo URL: IP address and standard headers, no referrer, no app data | Settings, Profile, or Backup & Restore shown while signed in | Disconnect Google | Data safety form (with Google sign-in) |
| Share targets | CSV or PNG the user chose | User taps Share | The user picks the target | CSV is labeled "not a full backup" |
| Email or WhatsApp | A message the user writes | User taps the feedback option | The user edits or cancels | — |

The project never receives, stores, or sees any of this data (DATABASE §8.1).

### 11.2 Rules

- Never log amounts, notes, merchants, category names, emails, PIN hashes, tokens, Drive file contents, or raw Drive error bodies. This applies to `console.*` in release builds as well.
- `lastAutoBackupError` stores an **error category or code only**, never raw server text (DATABASE §4.9).
- Tokens live only in memory and in the plugin's native store. The app never persists them.
- Excluded from backups: PIN hash and salt, profile cache, preferences, reconciliations, and review state.
- Disconnecting Google keeps local and remote data. A forgotten-PIN reset deletes all local keys, including quarantine, and keeps remote data.
- Tests, fixtures, screenshots, and examples use synthetic data only.

---

## 12. Failure Handling

| Scenario | Detection | Behavior | Data state |
|---|---|---|---|
| Offline before a Drive call | `navigator.onLine` plus a fetch `TypeError` | Show immediately that Drive is unavailable. Auto-backup skips silently | Local data unchanged |
| Timeout | Request timer (MVP-cleanup) | Retry if idempotent. Otherwise re-check remote state, then report | Unchanged, or the remote state is re-read |
| Token expired | 401 | One forced refresh and one retry, then `auth.expired` and "Reconnect" | Unchanged |
| Permission removed | 403 with a permission reason, or refresh failure | Drop the profile cache and show "Reconnect" | Unchanged |
| Rate limited or server error | 403 or 429 with a rate reason, or 5xx | Back off (§9.3) | Unchanged |
| Drive full | `storageQuotaExceeded` | "Free up Drive space" | Unchanged |
| Folder or file missing | 404 | Clear the folder cache and look it up again once. Restore reports "No backup found" | Unchanged |
| Remote has more transactions, or is unreadable | Shrink guard | Manual: ask, then make the pre-overwrite copy. Auto: pause with a notice | Remote kept |
| Pre-overwrite copy fails | D8 error | Abort the replacement | Remote kept |
| Metadata and content out of step | D6 succeeds, D7 fails | MVP-cleanup: use a single multipart update (§6.2.3) | — |
| Newer, corrupt, or unmigratable backup | `validateBackup` | Refuse with a specific message | Local data unchanged |
| Local write fails during restore | Storage exception | Roll back every key | Local data unchanged |
| App killed during upload | — | The next run re-checks D3. The hash and timestamp are recorded only after success | Remote is either the old or the new full file |
| App killed during restore | — | Restore writes are synchronous. A partial write is rolled back only while the process is alive. **Open risk:** an interruption mid-loop can leave mixed keys. Report it; do not redesign it (D7) | Possibly mixed |
| Local storage full | `QuotaExceededError` | `storage.quota` banner | Unchanged |
| Plugin missing (browser) | Capability check | `platform.unsupported` explanation | — |
| Share cancelled or failed | Plugin rejection | A cancel is silent. A failure shows a toast | — |
| Crash reporter failure | Exception inside the adapter | Ignored | — |
| Unexpected render error | Error boundary | Full-screen message "Your saved data is safe" with Reload | Unchanged |

---

## 13. Known Gaps Between Code and This Contract

These gaps are reported here, not fixed. None of them is authorized for implementation by this document.

| # | Gap | Location | Section |
|---|---|---|---|
| G1 | Drive and auth adapters throw instead of returning typed results. Context actions rethrow | `googleDrive.ts`, `googleAuth.ts`, `BackupContext.tsx` | §4.1, §5.4 |
| G2 | Drive requests have no timeouts | `googleDrive.ts` | §6.2.2 |
| G3 | Idempotent Drive calls have no retry with backoff | `googleDrive.ts` | §9.3 |
| G4 | Manual backup, check, and restore do not check for offline state before calling | `BackupContext.tsx` | §12 |
| G5 | **Resolved 2026-11-12.** `driveFetch` logs the method, status, and Drive reason only | `googleDrive.ts` | §11.2 |
| G6 | `lastAutoBackupError` can store raw Drive error text | `BackupContext.tsx` | §11.2, DATABASE §4.9 |
| G7 | **Resolved 2026-11-12 (D9):** Crashlytics removed, so nothing is sent | — | §6.7 |
| G8 | **Partly resolved 2026-11-12:** fonts are bundled. Still open: no Content Security Policy (needs a device check of the Google sign-in domains) | `index.html` | §1.1, ARCHITECTURE §15.3 |
| G9 | Metadata is patched before content, which is not atomic | `googleDrive.ts` | §6.2.3 |
| G10 | D3 has no `orderBy`, so the choice among same-named files is ambiguous | `googleDrive.ts` | §7 |
| G11 | A 403 rate-limit response is shown as "permission removed" | `BackupContext.tsx` | §6.2.5 |
| G12 | A failed pre-restore safety copy is swallowed without telling the user | `BackupContext.tsx` | §6.4 |
| G13 | No size check before downloading a backup | `BackupContext.tsx` | §6.3 |
| G14 | **Resolved 2026-11-12.** Backup `appVersion` comes from the build version | `backup.ts` | §6.3 |
| G15 | **Resolved 2026-11-12.** Analysis image share failures show a toast | `Analysis.tsx`, `lib/platform/share-image.ts` | §6.6 |
| G16 | Security actions return `boolean` with no reason | `SecurityContext.tsx` | §5.3 |
| G17 | **Resolved 2026-11-11.** Every storage key name now lives in `lib/storage/keys.ts`; a unit test fails if another source file contains one | `lib/storage/keys.ts` | §5.1, DATABASE §3 |

---

## 14. Change Control

- A new endpoint, network destination, SDK, Android permission, OAuth scope, or Capacitor plugin needs an ADR and owner approval (ARCHITECTURE §20).
- A change to the backup schema needs a version bump, an upgrade path, a refusal of newer files, tests, and an ADR (DATABASE §10.2).
- A first-party API is **Future** only. If it is ever approved, it must use versioned `/api/v1` paths, a contract-first schema, **server-side verification of Google ID tokens**, an owner identity on every row with database-enforced row-level security, and server-side rate limiting (ARCHITECTURE §10.4, DATABASE §8.3).
- To register this document, the owner adds it to AGENTS.md §1.1, sets its precedence in §1.3, and points ARCHITECTURE §10 and §11 here.
