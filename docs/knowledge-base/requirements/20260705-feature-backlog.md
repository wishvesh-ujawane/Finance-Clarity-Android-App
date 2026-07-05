---
id: requirement-20260705-feature-backlog
title: Feature brainstorm backlog — productivity & usefulness ideas
date: 2026-07-05
updated: 2026-07-05
status: open
scope: [financial-clarity]
related:
  - ../features/dashboard.md
  - ../features/transactions.md
  - ../features/analysis.md
  - ../features/budgets.md
  - ../features/recurring-expenses.md
  - ../features/savings-goals.md
  - ../features/backup-restore.md
  - ../features/security.md
  - ../features/month-end-review.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Dashboard.tsx
  - artifacts/financial-clarity/src/pages/Transactions.tsx
  - artifacts/financial-clarity/src/pages/Analysis.tsx
  - artifacts/financial-clarity/src/pages/Budgets.tsx
  - artifacts/financial-clarity/src/components/analysis/TrendsPane.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/analysis-utils.ts
  - artifacts/financial-clarity/src/lib/finance-utils.ts
---

# Feature brainstorm backlog — productivity & usefulness ideas

## Source
Chat request on 2026-07-05: *"What do you think? What all the different feature
we can introduce to make the app more productive and useful"*, followed by:
*"Document this findings — add one more thought — we can show category wise
spent in the trends tabs for each month."*

## Statement
Capture the brainstormed set of feature ideas as a durable backlog inside the
knowledge base so we can pick from it deliberately in later planning cycles,
rather than losing the thinking to chat history.

## Interpretation
This is a **backlog**, not a batch of accepted requirements. Each idea below
has its own local `status`:

- `idea` — proposed here; no commitment, no plan yet.
- `accepted` — approved for build; graduates to its own
  `requirement-<date>-<slug>.md` entry with acceptance criteria.
- `rejected` — decided not to build; a one-line reason is added inline.
- `superseded` — replaced by a different idea; link the replacement.

Deviation from [_templates/requirement.md](../_templates/requirement.md): the
template is single-requirement shaped, but this entry is a curated backlog. We
keep the required frontmatter (id / date / status / scope / related /
source-of-truth-files) and swap the "acceptance criteria" section for the
tables below. When any single idea is approved for build, it moves out to a
dedicated requirement file and the row here is marked `accepted → see
<link>`.

## Sizing legend
- **S** — a day or so; single file / single screen; no schema or contract change.
- **M** — a small feature; a few files, possibly a new component; still
  additive on schema / contract.
- **L** — a real feature; touches multiple screens, storage shape, or
  platform capabilities; needs an ADR before build.

**Sensitive** flag = touches user data at a new boundary (SMS, panic wipe,
shared devices). These require a dedicated security section in their plan.

## Cross-cutting consistency rules for anything in this backlog
Anything picked up from this list must, before it ships:

- Use the shared money formatter (`formatINR` / `formatAmount`) from
  [lib/finance-utils.ts](../../../artifacts/financial-clarity/src/lib/finance-utils.ts) —
  no inline `₹` or hand-rolled Indian grouping.
- Route money math through the shared sanitizer / existing helpers — no raw
  `parseFloat` on user input.
- Reuse `FinanceContext` / `FabContext` / `BackupContext` / `SecurityContext`
  under [src/context/](../../../artifacts/financial-clarity/src/context/) — do
  not fork state.
- Reuse shadcn/ui primitives in
  [src/components/ui/](../../../artifacts/financial-clarity/src/components/ui/)
  and existing motion constants (see [features/analysis.md](../features/analysis.md)).
- Additive-only Drizzle schema changes if the idea ever grows a backend
  component (see [decisions/0001-knowledge-base-bootstrap.md](../decisions/0001-knowledge-base-bootstrap.md)
  and the additive rule in the mode charter).
- Keep the app localStorage-first — backend packages under
  [lib/](../../../lib/) are placeholders today
  (see [architecture/api-server.md](../architecture/api-server.md),
  [architecture/db.md](../architecture/db.md)).

## Ideas by theme

### 1. Capture faster — less thumb work

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 1.1 | Quick-add chips on FAB long-press (top 3 categories + last-used amount, 1-tap re-entry) | S | [fab.md](../features/fab.md), [transactions.md](../features/transactions.md) | idea |
| 1.2 | Split transaction across multiple categories (additive `splits[]` field) | M | [transactions.md](../features/transactions.md), [analysis.md](../features/analysis.md) | idea |
| 1.3 | Templates / favourites ("Metro ₹40, Travel" saved for 1-tap log) | S | [transactions.md](../features/transactions.md) | idea |
| 1.4 | Voice add — Capacitor speech-to-text → parse amount + category guess | M | [transactions.md](../features/transactions.md) | idea |
| 1.5 | **SMS import (opt-in, Android)** — parse bank / UPI SMS into *pending* transactions the user confirms; never auto-write | L, **sensitive** | [transactions.md](../features/transactions.md), [security.md](../features/security.md) | idea |
| 1.6 | UPI reference field on a transaction (searchable later) | S | [transactions.md](../features/transactions.md) | idea |

### 2. Turn data into decisions

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 2.1 | Search across transactions (text on note + category + amount range) | S | [transactions.md](../features/transactions.md) | idea |
| 2.2 | Merchant / payee dimension (infer or add per transaction; group in Analysis: "You spent ₹4,120 at Swiggy this month") | M | [transactions.md](../features/transactions.md), [analysis.md](../features/analysis.md) | idea |
| 2.3 | Smart insights on Overview ("Food up 32% vs 4-week avg") — pure derived data extension of [analysis-utils.ts](../../../artifacts/financial-clarity/src/lib/analysis-utils.ts) | M | [analysis.md](../features/analysis.md) | idea |
| 2.4 | Anomaly / duplicate detection (same day + same amount + same category → flag) — toast on save + badge in list | S | [transactions.md](../features/transactions.md) | idea |
| 2.5 | Cash-flow forecast (recurring + avg discretionary + budgets → projected end-of-month balance) — slots into Planning pane | M | [analysis.md](../features/analysis.md), [recurring-expenses.md](../features/recurring-expenses.md) | idea |
| 2.6 | Category drill-in from Dashboard donut slice → filtered Transactions view | S | [dashboard.md](../features/dashboard.md), [transactions.md](../features/transactions.md) | idea |
| 2.7 | **Category-wise spend per month in Trends** — extend the MoM chart in [TrendsPane.tsx](../../../artifacts/financial-clarity/src/components/analysis/TrendsPane.tsx) so each month's bar breaks down by category (stacked bar or grouped mini-bars). Shows *what changed* MoM, not just *how much*. Recharts `Bar` with `stackId` is enough — no new dependency. | S–M | [analysis.md](../features/analysis.md) | idea |

### 3. Planning & discipline

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 3.1 | Envelope / weekly allowance (monthly budget ÷ weeks left → today's "safe to spend" on Dashboard) | M | [dashboard.md](../features/dashboard.md), [budgets.md](../features/budgets.md) | idea |
| 3.2 | Per-category rollover rule (rollover / reset / cap) — extension of the current carry-forward | S | [budgets.md](../features/budgets.md) | idea |
| 3.3 | Goal contributions from a transaction — mark a transfer as "contributes ₹X to Emergency Fund"; auto-updates the goal | S | [savings-goals.md](../features/savings-goals.md), [transactions.md](../features/transactions.md) | idea |
| 3.4 | Bills calendar derived from recurring expenses + upcoming bills, with a "due in 3 days" nudge | M | [recurring-expenses.md](../features/recurring-expenses.md) | idea |

### 4. Income side (currently underweighted)

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 4.1 | Multiple income sources (salary, freelance, interest) — labeled and charted separately on Dashboard | S | [dashboard.md](../features/dashboard.md), [transactions.md](../features/transactions.md) | idea |
| 4.2 | Expected vs. actual income (income equivalent of budgets) | S | [budgets.md](../features/budgets.md) | idea |

### 5. Data safety & control (mobile-app trust)

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 5.1 | Auto-backup schedule (weekly Drive backup + "last backup: 3 days ago" in Settings) | S | [backup-restore.md](../features/backup-restore.md), [settings.md](../features/settings.md) | idea |
| 5.2 | Encrypted local backup file — passphrase-protected `.fcbak` for users who don't want Drive | M | [backup-restore.md](../features/backup-restore.md) | idea |
| 5.3 | Export month statement to CSV / PDF, shareable via Android share sheet | S | [analysis.md](../features/analysis.md), [transactions.md](../features/transactions.md) | idea |
| 5.4 | PIN change flow + biometric fallback polish | S | [security.md](../features/security.md) | idea |
| 5.5 | **Panic wipe** — hidden gesture in Settings that clears local data after confirmation (useful on shared devices) | S, **sensitive** | [security.md](../features/security.md), [settings.md](../features/settings.md) | idea |

### 6. Delight & UX polish

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 6.1 | Home-screen widget (today's spend + this month's balance) — native Android | M | [dashboard.md](../features/dashboard.md) | idea |
| 6.2 | Notification quick-add — persistent low-priority notification with "Add expense" action | M | [transactions.md](../features/transactions.md) | idea |
| 6.3 | Themes (dark mode + one alternate accent) — token-driven | S | [architecture/financial-clarity.md](../architecture/financial-clarity.md) | idea |
| 6.4 | Empty-state richness (illustrations + "Add your first ..." prompts across screens with blank lists) | S | all screens | idea |
| 6.5 | Haptics on save / swipe / long-press (Capacitor Haptics) | S | [fab.md](../features/fab.md), [transactions.md](../features/transactions.md) | idea |
| 6.6 | Undo toast on delete transaction (5-second undo instead of confirm modal) | S | [transactions.md](../features/transactions.md) | idea |

### 7. Bigger bets (need an ADR before build)

| # | Idea | Effort | Composes with | Status |
|---|------|--------|---------------|--------|
| 7.1 | Multi-account / multi-wallet (Cash / HDFC / UPI as separate ledgers; transfers between them) — changes the data model | L | [transactions.md](../features/transactions.md), [dashboard.md](../features/dashboard.md), [backup-restore.md](../features/backup-restore.md) | idea |
| 7.2 | Shared / family mode (two devices, one dataset, via shared Drive file or QR-linked sync) | L, **sensitive** | [backup-restore.md](../features/backup-restore.md), [security.md](../features/security.md) | idea |
| 7.3 | Tax buckets — tag deductible spend (80C, medical) → year-end summary for ITR | M | [categories.md](../features/categories.md), [analysis.md](../features/analysis.md) | idea |
| 7.4 | Debts / EMIs / lends — track "You owe / You are owed" as a first-class thing distinct from transactions | M | [transactions.md](../features/transactions.md), [recurring-expenses.md](../features/recurring-expenses.md) | idea |

## Top-5 recommendation (best composability × user value × effort)
1. **2.1** — Search across transactions (S).
2. **2.6** — Category drill-in from Dashboard (S).
3. **2.7** — Category-wise spend per month in Trends (S–M).
4. **5.1** — Auto-backup schedule + last-backup indicator (S).
5. **6.1** — Home-screen widget (M).

## Impact
- No code, schema, or contract impact from *this entry* — it is a backlog.
- Each idea, when promoted to `accepted`, will get its own requirement entry
  with acceptance criteria and its own plan-and-wait cycle.

## Resolution
Open. Individual ideas will link their resolution (commit / feature entry
updated) inline in their row's `Status` column as they are picked up.
