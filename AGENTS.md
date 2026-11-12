# AGENTS.md — Rules for Coding Agents

These rules apply to every coding agent working in this repository, for every task. They are mandatory unless the owner explicitly overrides one in the current conversation.

---

## 1. Sources of Truth

### 1.1 Core documents

These five files in [docs/](./docs/), plus this file at the repository root, are the project's main documents. Read the relevant parts before you plan or write code:

| Document | Governs |
|---|---|
| [docs/PRD.md](./docs/PRD.md) | Product scope, functional requirements, the financial baseline (§6), owner decisions (§15) |
| [docs/DESIGN.md](./docs/DESIGN.md) | UX, design tokens, components, states, accessibility, terminology |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Layers, data flow, folder structure, security, error handling, testing, deployment. §10 and §11 keep only the summary; detailed contracts live in API.md |
| [docs/API.md](./docs/API.md) | Internal contracts (context actions, storage layer, platform adapters), result envelope and error codes, Google Sign-In and Drive contracts, backup and CSV file contracts, allowed network destinations, retries and quotas, environment configuration, data leaving the device |
| [docs/DATABASE.md](./docs/DATABASE.md) | On-device data model, storage keys, constraints, migrations, sensitive data |
| [AGENTS.md](./AGENTS.md) | How the coding agent works: process, code rules, and change discipline (this file). Stays at the root so coding tools can find it |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Proposed implementation sequence only; subordinate to the core documents and not authorization to implement |

Supporting reference: [docs/knowledge-base/](./docs/knowledge-base/) holds detailed history, decisions (ADRs), bugs, and feature records. It adds detail but never overrides a core document.

This file replaces all earlier agent definitions and instruction files. No other agent persona applies in this repository.

### 1.2 Adding new documents

The owner will add more project documents over time. When a new document is introduced:

1. **Register it** by adding a row to the table in §1.1 that states what it governs. A document that is not registered there is reference material, not a source of truth.
2. **Set its precedence** in §1.3, and state which existing document sections it takes over (for example, API.md takes over the detailed contract content of ARCHITECTURE §10 and §11).
3. **Remove overlap.** Point the older document to the new one instead of keeping two copies of the same rule. Report any conflict to the owner rather than choosing a winner yourself.
4. **Update this file's references** (rules that cite the older section) in the same change.

Do not create new top-level project documents on your own. Add one only when the owner asks for it.

### 1.3 Precedence and conflicts

**Precedence:** PRD (scope) → DESIGN (UX) → ARCHITECTURE (structure) → API (integration contracts) → DATABASE (data). API.md is authoritative for the contract details it took over from ARCHITECTURE §10 and §11; ARCHITECTURE still wins on layers, structure, and principles. AGENTS.md governs process and working rules, not product behavior. The implementation plan is sequencing guidance only; it cannot change scope, resolve pending decisions, or authorize implementation. If two documents disagree, or the code disagrees with a document:

- **Report the gap.** Do not resolve it silently.
- **Do not treat existing code as precedent.** Known gaps are listed in DESIGN §15, ARCHITECTURE §19, API §13, and DATABASE.
- **Respect the labels.** Items marked **Approved change** or **MVP-cleanup** are not authorized for implementation unless the owner asks for them. Items marked **Proposed** (for example the result envelope and error codes in API §4) must not be used in code until the owner confirms them. Items marked **Pending review**, **Deferred**, or **Future** must not be implemented.

---

## 2. Core Operating Rules

1. **Inspect before you change.** Read the files you will touch, their callers, their tests, and the nearest similar feature. Never edit code you have not read.
2. **Follow the documents.** Every change must trace to a requirement, an owner request, or a documented gap.
3. **Reuse before you create.** Search for an existing helper, component, context action, schema, or pattern first. Extend it instead of writing a parallel version.
4. **Make surgical changes.** Change only what the task needs. Do not reformat, rename, reorganize, or "clean up" unrelated code.
5. **Do not rewrite.** Refactor in small steps that preserve behavior. No big-bang reorganizations (ARCHITECTURE §7.2).
6. **Add no unnecessary dependencies.** See §6.
7. **Never expose secrets.** See §9.
8. **Stay in scope.** Never add features listed as out of scope in PRD §13, including SMS, a backend, sync, AI, bank linking, multiple currencies, analytics, or iOS.
9. **Ask when you are unsure.** For ambiguous requirements, pending owner decisions, or changes with more than one reasonable approach, stop and ask. Do not guess.
10. **Plan first for non-trivial work.** Present a short plan with the files affected, the risks, and how you will validate it. Wait for approval before you implement.

---

## 3. Project and Folder Structure

### 3.1 Workspace

| Path | Status | Rule |
|---|---|---|
| `artifacts/financial-clarity/` | **The product** (Vite + React + Capacitor Android) and the only workspace package | All app work happens here |
| `docs/` | Core documents (§1.1), implementation plan, testing notes, build guides | Keep the core documents here; AGENTS.md stays at the root |
| `scripts/` | Android build helpers (`build-debug-apk.ps1`, `clean-build.ps1`) | Plain scripts, not a workspace package |
| `docs/knowledge-base/` | Canonical project record | Update it after non-trivial work (§12) |
| `docs/audits/`, `docs/manuals/` | Reports and manuals | Add dated files; do not rewrite history |

### 3.2 App source layers (`artifacts/financial-clarity/src`)

Dependencies point **downward only** (ARCHITECTURE §4.1):

| Layer | Location | May import |
|---|---|---|
| App shell | `main.tsx`, `App.tsx` | Everything below |
| Pages | `pages/` (one file per route) | Components, context hooks, formatters and selectors |
| Components | `components/` (`ui/` primitives, feature folders) | Other components, formatters |
| State | `context/` | Domain, storage, platform |
| Domain | `lib/domain/` (target) | Nothing except types. Pure: no React, no I/O |
| Storage | `lib/storage/` (target) | Domain types and schemas |
| Platform | `lib/platform/` (target) | Capacitor plugins and Google APIs only |

Hard rules:

- **Pages and components must not import** `localStorage`, `@capacitor/*`, Google modules, or storage key strings.
- **Only the storage layer** touches `localStorage`. All key names live in one module.
- **Only the platform layer** calls Capacitor plugins or Google APIs.
- **Only `FinanceContext`** writes finance entities.
- The `lib/domain/`, `lib/storage/`, and `lib/platform/` folders are the target structure. Move existing files into them **only when you are already changing that code, and only one layer per change**. Keep public hook APIs unchanged while you move code.
- Put tests in `__tests__/` folders next to the code they cover.

---

## 4. Code Quality and Naming

- **Match the surrounding style.** Follow the conventions of the file and folder you are editing. Use Prettier (the workspace formatter) on the lines you change only.
- **Files:** React components and pages use `PascalCase.tsx` (`TransactionSheet.tsx`). Libraries and helpers use `kebab-case.ts` (`finance-utils.ts`). Contexts use `<Name>Context.tsx`. Tests use `<name>.test.ts(x)`.
- **Identifiers:** `PascalCase` for components, types, and interfaces. `camelCase` for functions, variables, and hooks (`useX`). `UPPER_SNAKE_CASE` only for true constants.
- **Domain vocabulary:** use the terms from PRD §6 and DESIGN §3.3 exactly: income, consumption spending, savings contributions, monthly net, carry-forward, lifetime balance, commitments, outstanding card amount. Do not invent synonyms.
- **User-facing name:** "Fiscal Focus". Do **not** rename `appId` (`com.bytetobrain.fiscalfocus`), the `financial-clarity:` storage prefix, package names, or backup paths for branding (PRD FR-01).
- **Functions** are small and do one thing. Prefer pure functions for any calculation.
- **No dead code.** Do not leave commented-out code, unused exports, or `console.log` debugging in commits.
- **Comments** explain *why*, not *what*. Add them only where the reasoning is not obvious.

---

## 5. Component and Logic Reuse

- **UI:** build new screens from existing components in `src/components/` and `src/components/ui/`, following DESIGN §5. A new component or design token needs a short rationale added to DESIGN.md in the same change (DESIGN §14).
- **Styling:** use only semantic tokens from `index.css` and the Tailwind theme. **No raw hex, hsl, or Tailwind palette colors** in components (DESIGN §2, G13).
- **Money formatting:** use the canonical formatters in `lib/format.ts` (DESIGN §4.6): `formatAmount` for display, `formatAmountFull` where exact values are confirmed, and `formatAmountShort` on charts only. Do not add another formatter, and do not use the deprecated `formatINR` or `formatShortINR` aliases in new code.
- **Dates and months:** use the shared helpers in `lib/domain/periods.ts` (`currentMonth`, `addMonths`, `localDateStr`, `monthOf`, `lastDateOfMonth`, and others). Do not hand-roll month math, and do not add a date library.
- **Financial metrics:** every PRD §6 metric has **exactly one implementation** in `lib/domain/finance-metrics.ts`. Pages must not re-sum transactions. Add a function there or reuse an existing one.
- **State:** use the existing contexts (`FinanceContext`, `SecurityContext`, `BackupContext`, `MonthEndReviewContext`, `FabContext`). Do not add Redux, Zustand, or another state library.
- **Forms:** use controlled React state with the shared entity validators. Do not add a form library. Keep entered values on any error (DESIGN §7).
- **Validation:** one validator (a TypeScript type guard) per entity, shared by forms, storage reads, backup restore, and CSV import (DATABASE §6.1). Do not add a schema library.

---

## 6. Dependency Management

- **Use pnpm only.** Never use npm or yarn, and never commit `package-lock.json` or `yarn.lock`.
- **Prefer what already exists:** platform APIs (`Intl`, WebCrypto), existing packages, then a small local helper. Add a new package only when none of these works.
- **Every new runtime dependency** needs a written reason (what it does, why existing options are not enough, its size, and its maintenance status), and owner approval before you install it.
- **New external services, network destinations, SDKs, OAuth scopes, Android permissions, or Capacitor plugins** need an ADR and owner approval (ARCHITECTURE §20, API §14).
- **Never weaken the supply-chain policy:** keep `minimumReleaseAge: 1440` in `pnpm-workspace.yaml`, and do not add entries to `minimumReleaseAgeExclude` without an ADR.
- **Commit `pnpm-lock.yaml`** together with any manifest change. Do not edit the lockfile by hand.
- Use the `catalog:` versions in `pnpm-workspace.yaml` where a package is already catalogued.
- Do not upgrade major versions as a side effect of another task.
- Keep the Google auth plugin pinned at its current version unless the owner approves a change.
- When you remove code, also remove dependencies that become unused, including unused `components/ui` primitives and their Radix packages.

---

## 7. Type Safety

- Keep the existing compiler checks in `tsconfig.base.json` and package `tsconfig.json` files (for example `strictNullChecks`). Never loosen them; tightening them needs owner approval.
- **Do not use `any`.** Use `unknown` and narrow it. Do not use `@ts-ignore` or `@ts-expect-error` without a comment that explains why.
- **Do not use non-null assertions (`!`)** to silence errors on data that can really be missing.
- **Domain types** live in `lib/types.ts`. Reuse them; do not redeclare entity shapes.
- **Validate untrusted data at the boundary** with the shared type guards: storage reads, backup files, CSV rows, plugin results, and Drive responses. Code after the boundary works with typed, validated values.
- **Represent money and dates with the documented logical types** (DATABASE §2):
  - money is a positive, finite number of rupees, and direction comes from the transaction type;
  - financial dates are `YYYY-MM-DD` local dates;
  - months are `YYYY-MM`;
  - event timestamps keep their existing representation.
- **Do not introduce a new money model** (such as integer paise) without an ADR (PRD §6, D3).
- **Fallible operations return typed results** (`ok` or `error` values), not thrown exceptions, at storage and platform boundaries.
- `pnpm run typecheck` must pass before you call any change done.

---

## 8. Error Handling

Follow ARCHITECTURE §14, API §4 and §12, and DESIGN §8.

- **Never report success before the data is durably saved** or the remote operation has finished.
- **Persist first:** validate → apply domain rules → write to storage → update React state **only if the write succeeded** (ARCHITECTURE §6.2).
- **Never swallow errors.** Do not use empty `catch` blocks, and do not catch an error only to log it when the user needs to know about it.
- **Errors are returned as values** at the storage and platform boundaries. Contexts turn them into user-facing messages using the error taxonomy (ARCHITECTURE §14.2, API §4.2).
- **Every message says** what happened, whether data is safe, and what to do next. Messages never contain financial data, emails, tokens, file contents, or raw server text (API §4.1).
- **A user cancel is not an error.** Closing the account picker or share sheet returns to idle without an error message (API §4.2).
- **Keep form values** after validation or save errors. Submit buttons go busy immediately and ignore repeated taps.
- **Multi-key writes** take a snapshot first and roll back on failure, in the order given in DATABASE §7.3.
- **Corrupt data is quarantined**, never silently dropped or overwritten (DATABASE §6.1).
- **Never show** `NaN`, `Infinity`, or a percentage calculated from a zero base. Show "insufficient history" instead of a misleading forecast.
- Background operations (backup, recurring processing, CSV import) are **single-flight and idempotent**.

---

## 9. Security, Privacy, and Secrets

- **Never commit secrets:** keystores, `keystore.properties`, `google-services.json`, `.env*` files with real values, tokens, or passwords. Check `git diff --cached` before every commit.
- **Never print, log, or paste secrets** into chat, commits, issues, or files.
- **Never put secrets in client configuration.** Anything prefixed `VITE_` is compiled into the public bundle. The client needs no secrets, and a Google client secret must never appear in the repo, the bundle, or `.env*` files (API §10).
- **Treat all financial data as sensitive** (DATABASE §9.1, API §11). Never log amounts, notes, merchants, category names, emails, PIN hashes, tokens, backup contents, full request URLs, or raw Drive error bodies. Diagnostics carry error codes and operation names only.
- **Crashlytics:** send scrubbed payloads only, and never set a user ID from the Google email.
- **The PIN** is stored only as a salted hash. Never store, log, or export the PIN or its hash.
- **OAuth tokens** are managed by the plugin and held in memory only. Never write them to app storage or logs (API §3.4).
- **Use least privilege:** Google scopes stay `profile`, `email`, and `drive.file` (API §3.4). Do not add Android permissions. `READ_SMS` is being removed and must never be added back.
- **Keep** `android:allowBackup="false"`.
- **Never render** user or imported data as raw HTML. Escape CSV cells that start with `=`, `+`, `-`, or `@`.
- **Treat imported files** (backup JSON, CSV) as untrusted: check size limits, validate the schema, check the version, show a preview, and require explicit confirmation.
- **Locked means not rendered.** Financial content must not be mounted while the app is locked.
- Use **synthetic data only** in tests, fixtures, screenshots, and examples.
- **Never weaken or bypass** a security control to make a task easier.

---

## 10. Data and API Access

### 10.1 On-device data (DATABASE.md)

- **No backend, no server database, no first-party API** in the MVP (PRD §10). Do not add one.
- **Access storage only through the storage layer.** No component, page, or hook calls `localStorage` directly.
- **Never rename or reuse storage keys.** The `financial-clarity:` prefix is frozen.
- **Never rewrite or reuse IDs.** Preserve historical references.
- **Enforce business rules in domain mutations**, not only by hiding UI. For example, a used category cannot be deleted (PRD FR-03).
- **Schema changes require:**
  - a forward-only, idempotent local migration that writes `storage-version` last (DATABASE §10.1);
  - a backup schema version bump with an upgrade path for old backups, and refusal of newer backups (DATABASE §10.2);
  - tests for both;
  - an ADR and owner approval.
- **Migrations must never leave data the current code cannot read.** Google Play cannot roll back an app.
- **Keep old backups restorable.** Keep legacy SMS keys readable, and never use them to reactivate SMS features.
- **Do not store derived totals.** Compute them with memoized domain selectors.
- **Recurring generation** must follow the invariants in DATABASE §6.3: an occurrence key, a forward-only cursor, short-month clamping, skipped paused months, and no duplicates.

### 10.2 Internal contracts (API §5)

- **Pages and components** reach data and services only through the context hooks (`useFinance`, `useSecurity`, `useBackup`, `useMonthEndReview`, `useFab`) listed in API §2.
- **Keep context actions, storage functions, and adapter signatures stable.** If one must change, update API §5 in the same change and update every caller.
- **Validate at every boundary** as listed in API §4.3, and use the data formats in API §4.4.
- **Respect the concurrency guards** in API §4.5: one backup, restore, or remote check at a time, single-flight recurring processing, and an all-or-nothing CSV import.

### 10.3 External APIs and integrations (API §1, §6–§12)

- **Use only the allowed network destinations** in API §1.1. Do not add any new destination, SDK, or remote config.
- **Google Drive is the only remote API.** Access it only through the `googleDrive` platform adapter, and follow the Drive and backup file contracts in API §6.
- **Every request** has a timeout and returns a typed result. The adapter never throws to the UI.
- **Retry only idempotent operations** (list, download, folder lookup) with exponential backoff on 429 and 5xx, following API §9.3. Never retry uploads blindly; re-check the remote state first.
- **On 401,** refresh the token silently once, then show a "reconnect Google" state.
- **Detect offline state** before a call, and keep local use working.
- **Respect app-side throttling** for auto-backup and PIN attempts (API §9.2).
- **Native plugins** are reached only through platform adapters. Adapters check that the capability exists and return a typed "unsupported" result in the browser.
- **The app has no inbound endpoints,** webhooks, Drive push notifications, or deep links (API §8). Do not add them.
- **Configuration** is fixed at build time and documented in API §10. Do not add environment variables without updating that section.

---

## 11. Testing

- **Run the smallest relevant check first,** then widen it:
  - `pnpm --filter @workspace/financial-clarity run test:run` (Vitest)
  - `pnpm run typecheck` (whole workspace; **required before any change is done**)
  - `pnpm run build` (before release-affecting changes)
- **Add or update tests** for every behavior change and every bug fix. A bug fix includes a test that fails without the fix.
- **Required coverage areas** (ARCHITECTURE §16.1):
  - every PRD §6 metric;
  - period boundaries;
  - recurring rules (short months, leap years, pause/resume, catch-up, no duplicates on repeated runs);
  - category used/unused and active/inactive rules;
  - budget copy overwrite rules;
  - storage failure leaves state unchanged;
  - quarantine;
  - idempotent migrations;
  - restore of v1–v3 backup fixtures, and refusal of newer backups;
  - cross-screen consistency of totals.
- **Component tests** use React Testing Library. Test behavior that users see, not implementation details.
- **Never delete, skip, or weaken a test** to make a change pass. If a test is wrong, explain why and get approval.
- **Do not change existing behavior** without a test that documents the new behavior.
- **Report what you ran** and its result. Do not claim that runtime, device, or Play Store checks passed unless they actually ran.
- **Device testing** (PRD §14, DESIGN §14) is manual. List the steps for the owner when a change needs it.

---

## 12. Documentation

- **Update related documentation in the same change.** This includes the core documents (§1.1), any documents registered later, build docs, and code comments, whenever behavior, structure, data, or contracts change. Update API.md whenever a context action, adapter, result shape, error code, external call, or configuration value changes.
- **Do not edit PRD decisions** (PRD §15) or approval labels without explicit owner approval.
- **Knowledge base** (`docs/knowledge-base/`):
  - The former "App Oracle" agent and its single-writer rule are **retired**. Where older documents (for example ARCHITECTURE §7.1 and §20, and `docs/knowledge-base/README.md`) say "only the App Oracle edits the knowledge base", the coding agent now makes those updates directly under the rules below.
  - After non-trivial work, update the relevant entries using the templates in `docs/knowledge-base/_templates/`, and add a line to `docs/knowledge-base/CHANGELOG.md`.
  - Record architectural decisions as ADRs in `docs/knowledge-base/decisions/`. Use an ADR for anything listed in ARCHITECTURE §20.
  - Record bugs with their root cause and fix in `docs/knowledge-base/bugs/`.
  - Follow the existing entry format. Do not restructure the knowledge base.
- **Feature backlog:** for "what should I build next?" questions, suggest items from `docs/knowledge-base/requirements/20260705-feature-backlog.md` with their IDs. Backlog ideas are not approved requirements.
- **Do not create** planning, notes, or summary Markdown files unless the owner asks for them.
- **Write in plain English:** short sentences, defined terms, and no marketing language.

---

## 13. Git and Change Discipline

- **Never commit directly to `main`.** Create a branch from an up-to-date `main`:
  - `feature/<slug>` for features;
  - `fix/<slug>` for bug fixes;
  - `chore/<slug>`, `docs/<slug>`, or `refactor/<slug>` for other work.
- **Ask the owner before every commit and before every push.**
- **Use Conventional Commits:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, with an optional scope (for example, `fix(recurring): clamp to last day of month`).
- **One logical change per commit.** Do not mix refactors, formatting, and behavior changes.
- **Stage only the files you changed for the task.** Never use `git add .` blindly. Review `git diff --cached` for unrelated edits and secrets.
- **Never rewrite history:** no `git push --force`, `git reset --hard` on shared branches, or rebasing published commits, unless the owner explicitly approves it in the same conversation.
- **Never discard the owner's uncommitted work.** If the working tree has unrelated changes, leave them alone and mention them.
- **Before you finish:** typecheck and tests pass, docs are updated, and no debug code, secrets, or unrelated changes are left.
- **Your final summary** lists the files changed, what each change does, the checks you ran and their results, and any gaps or follow-ups you found but did not fix.

### 13.1 Release notes on every deployment

Every deployment (any APK or AAB given to users or uploaded to Google Play) must add an entry to the in-app **What's New** screen, in the same change as the release:

- Add the entry at the **top** of `CHANGELOG_ENTRIES` in `artifacts/financial-clarity/src/lib/changelog.ts`.
- Include the **release date** (`YYYY-MM-DD`) and the **app version** from `package.json`.
- Write **1 to 4 short lines** in simple language. Mark each line `new` (something added) or `fixed` (a bug fixed). Keep each line under 140 characters.
- Describe what the user notices, not code details. Never include financial data, emails, or secrets.
- `src/lib/__tests__/changelog.test.ts` checks these rules. Do not weaken it to make an entry pass.

---

## 14. Definition of Done

A change is done only when **all** of the following are true:

- [ ] It traces to a requirement, an owner request, or a documented gap, and stays within approved scope.
- [ ] Existing code and patterns were inspected and reused.
- [ ] The layer rules (§3.2), the single-implementation rule for metrics, and the persist-first rule are respected.
- [ ] No new dependency, permission, service, network destination, OAuth scope, or storage key was added without approval.
- [ ] `pnpm run typecheck` passes, and relevant tests are added or updated and pass.
- [ ] No secrets or sensitive data appear in code, logs, fixtures, or commits.
- [ ] Related documentation and knowledge-base entries are updated.
- [ ] For a deployment, a What's New entry was added (§13.1).
- [ ] The diff contains no unrelated changes.
