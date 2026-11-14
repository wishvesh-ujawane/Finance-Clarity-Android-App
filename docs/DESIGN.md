# Fiscal Focus — Design System and UX Specification

**Version:** 1.0
**Updated:** 2026-11-05
**Product source of truth:** [PRD.md](./PRD.md)
**Applies to:** `artifacts/financial-clarity` (Android via Capacitor; browser is a development convenience only)

This document is the single source of truth for how Fiscal Focus looks, reads, and behaves. It codifies the design already in the app, resolves inconsistencies between screens, and sets rules for anything new. When this document and the implementation differ, the implementation is the gap — report it (see [§15 Known gaps](#15-known-gaps-between-this-spec-and-the-current-build)), don't treat it as precedent.

Rule language: **Must** = required for release. **Should** = default unless there is a written reason. **Avoid** = allowed only with a documented exception.

---

## 1. Visual Direction

### 1.1 Character: "a calm ledger"

Fiscal Focus is a tool people open several times a day to record money and check whether they are on track. The visual language is that of a well-kept ledger: ink on paper, numbers first, color reserved for meaning.

- **Ink:** deep navy for text and the single hero surface.
- **Paper:** near-white slate background, white cards, hairline borders.
- **One accent:** electric blue for interaction (active nav, primary buttons, focus, selection).
- **Money colors:** green, red, and sky blue exist only to mean income, spending, and savings.

### 1.2 Design principles

1. **Numbers are the interface.** Amounts are the largest, highest-contrast element in any block. Labels support numbers; they never compete with them.
2. **Color carries meaning, never decoration.** If a color doesn't say income, spending, savings, warning, error, or "you can tap this", it should be a neutral.
3. **One way to do one thing.** The same concept (a month, an amount, a category, a confirmation) looks and behaves the same on every screen.
4. **Fast entry, safe edits.** Adding a record is one tap plus a sheet. Destroying or overwriting anything always asks first and says exactly what will change.
5. **Honest states.** Never show a success that didn't happen, a percentage from a zero base, or a forecast without enough history. Say what's missing.
6. **Local and calm.** No celebratory noise in daily use, no growth-hacking patterns, no dark patterns around backup or sign-in.

### 1.3 What we deliberately avoid

- Gradients, glassmorphism, glow, neon, and 3D effects.
- Stock illustrations, mascots, and decorative empty-state art.
- Emoji as UI (status, icons, or labels).
- Drop shadows on resting cards. Shadows belong only to things that float.
- Generic "SaaS dashboard" patterns: KPI tiles with sparkline decoration, vanity metrics, gradient headers.
- More than one navy hero surface per screen.

The only decorative element permitted is the existing pair of low-contrast circles on the Dashboard balance hero. Do not add new decorative shapes.

### 1.4 Brand

- **Name:** Fiscal Focus (user-facing everywhere). Do not rename package IDs, storage keys, or backup paths for branding (PRD FR-01).
- **Mark:** Trending-up glyph, white, inside a 32 px accent-blue rounded square (radius 8).
- **Wordmark:** "Fiscal Focus" in the display face, weight 700. No tagline in the app chrome.

---

## 2. Color

All color is consumed through **semantic tokens**, never raw hex values or Tailwind palette names in components. This keeps screens consistent and keeps dark mode possible.

### 2.1 Core neutrals and accent (light theme — release theme)

| Token | Value | Use |
|---|---|---|
| `background` | Slate 50 `#F8FAFC` | App canvas |
| `foreground` | Navy `#0D1B3E` | Primary text, headings, amounts |
| `card` | White `#FFFFFF` | Card and sheet surfaces |
| `border` / `input` | Slate 200 `#E2E8F0` | Hairlines, card borders, dividers |
| `muted` | Slate 200 `#E2E8F0` | Input fills, segmented-control tracks, progress tracks |
| `muted-foreground` | Slate 500 `#64748B` | Secondary text, captions, eyebrows |
| `accent` | Electric Blue `#2563EB` | Primary actions, active nav, selection, focus ring |
| `accent-foreground` | White | Text/icons on accent |
| `hero` | Deep Navy `hsl(222 65% 13%)` | Balance hero and desktop sidebar only |

### 2.2 Money semantics

Each money meaning has three roles. **Text** values must be used for any amount or label printed on a light surface; **fill** values are for bars, dots, and solid buttons; **on-dark** values are for text on the navy hero.

| Meaning | Text on light | Fill (with white text) | Tint background | On navy hero |
|---|---|---|---|---|
| Income / positive | Emerald 700 `#047857` | Emerald 700 `#047857` | `#E6F4EC` | Emerald 400 `#34D399` |
| Spending / negative | Red 600 `#DC2626` | Red 600 `#DC2626` | `#FCEBEB` | Red 400 `#F87171` |
| Savings contribution | Sky 700 `#0369A1` | Sky 700 `#0369A1` | `#E0F2FE` | Sky 300 `#7DD3FC` |
| Neutral / zero | `foreground` | — | `muted` | White at 70% |

Rules:

- **Must** pick the money color from the transaction's meaning (PRD §6), not its raw type. A savings contribution is stored as an expense but is shown in savings blue.
- **Must** pair every money color with a non-color signal: a sign prefix, an arrow icon, or a text label (see [§4.6](#46-amount)).
- Card-bill payments are neither consumption nor income; show them in `foreground` with a "Card payment" label.
- Positive-is-green / negative-is-red applies to balances (lifetime, carry-forward, monthly net). Zero is neutral.

### 2.3 Status semantics

| Status | Text | Tint background | Use |
|---|---|---|---|
| On track | `foreground` (bar uses category color) | — | Budget below warning threshold |
| Warning | Amber 800 `#854F0B` | `#FAEEDA` | Budget 75–99% used |
| Over / error | Red 800 `#A32D2D` | `#FCEBEB` | Budget ≥100% used, failed operations, validation |
| Met / success | Green 800 `#1D7A4E` | `#E6F4EC` | Savings or commitment target reached, successful restore |
| In progress / info | Blue 900 `#1E3A8A` | `#EAF0FB` | Savings or commitment below target, informational banners |

### 2.4 Destructive

- Destructive buttons use Red 600 fill with white text. The current `destructive` token (Red 500) **must** be darkened to meet contrast.
- Low-emphasis destructive icon buttons use the red tint background with Red 600 icon.

### 2.5 Category colors

- Users choose from a fixed category palette. Every palette color **must** reach at least 3:1 against white so the icon remains visible on its tint.
- Category color appears only as: the icon glyph, the icon tile background at ~13% opacity, the progress-bar fill on budgets, and chart segments. Never as text color for names or amounts.
- Fallback when a category is missing: indigo `#6366F1` with the generic currency icon and the label "Unknown category".

### 2.6 Charts

- Category breakdowns use category colors. Cap at six segments; group the rest as "Other" in Slate 400.
- Income / spending / savings series use the money fills from §2.2.
- Neutral, non-category series use the chart ramp: Navy → Royal Blue `#1E3F7A` → Electric Blue → Light Blue `#0EA5E9` → Slate 500.
- Gridlines use `border`; axis labels use `muted-foreground` at the caption size.

### 2.7 Dark theme

Dark tokens exist but no user-facing toggle ships today. Light is the release theme.

- **Must** build every component from semantic tokens so dark mode costs no rework (no hard-coded white surfaces or navy values in components).
- Dark mode ships only when every screen passes the contrast rules in §12. No partial dark mode.

---

## 3. Typography

### 3.1 Typefaces

| Role | Family | Weights |
|---|---|---|
| Display: page titles, section titles, sheet titles, hero amounts | Manrope | 600, 700, 800 |
| Text: body, labels, inputs, list amounts | Inter | 400, 500, 600 |

- Fonts **must** be bundled with the app. Offline-first users can't rely on a font CDN.
- Inter is used only at 400/500/600. If a value needs more emphasis than Inter 600, set it in Manrope 700. No synthetic bold.
- All amounts and numeric columns use **tabular figures** so digits align in lists and don't jitter while counting.

### 3.2 Type scale

| Style | Family / weight | Size / line height | Use |
|---|---|---|---|
| Hero amount | Manrope 800 | 36 / 40 (steps to 30 at ≥ ₹1 L, 24 at ≥ ₹1 Cr) | Lifetime balance only |
| Page title | Manrope 700 | 24 / 32 | One per screen |
| Sheet / dialog title | Manrope 700 | 18 / 26 | Bottom sheets, dialogs |
| Card title | Manrope 700 | 14 / 20 | Card headers |
| Entry amount | Manrope 700 | 30 / 36 | Amount field in entry sheets |
| Body | Inter 400 | 14 / 20 | Descriptions, paragraphs |
| Body strong | Inter 500 | 14 / 20 | List-row primary text |
| Amount | Inter 600 | 14 / 20 | Amounts in rows and tiles |
| Label / eyebrow | Inter 600, uppercase, +0.05em tracking | 12 / 16 | Form labels, section labels, page eyebrow |
| Caption | Inter 400 | 12 / 16 | Secondary row text, helper text, timestamps |
| Micro | Inter 500 | 11 / 14 | Nav labels, chart axis, tile labels — **minimum size in the app** |

Rules:

- **Must not** render any text smaller than 11 px. Anything people need to read routinely (amounts, names, errors) is at least 12 px.
- Headings use sentence case ("Where did your money go?"). Uppercase is reserved for the label/eyebrow style.
- Truncate long category names and notes with an ellipsis. **Never truncate an amount.** Wrap the row or step the amount size down instead.
- At most three type sizes in a single card.

### 3.3 Voice and terminology

- Plain Indian English, second person, short sentences. "You spent ₹4,200 on Food this month," not "Expenditure detected."
- Use the PRD §6 vocabulary consistently and only these user-facing terms:

| Concept (PRD) | User-facing label |
|---|---|
| Lifetime balance | Lifetime balance |
| Consumption spending | Expenses (or Spending in analysis copy) |
| Savings contributions | Savings |
| Monthly net | {Month} balance |
| Carry-forward | Carry-forward |
| Commitments | Commitments |
| Outstanding card amount | On your card |

- **Dates:** `5 Nov 2026` in lists and forms; group headers use `Today`, `Yesterday`, then `Wed, 4 Nov`. **Months:** `November 2026` in pickers; `Nov 2026` where space is tight.
- **Buttons** name the outcome: "Add Expense", "Save Changes", "Copy to December", "Restore backup" — never "OK" or "Submit".

---

## 4. Foundations: Spacing, Layout, Shape, Elevation, Iconography

### 4.1 Spacing scale

Base unit 4 px. Use only these steps: **4, 8, 12, 16, 20, 24, 32, 48**.

| Context | Value |
|---|---|
| Page horizontal padding | 16 (mobile), 24 (≥ 768 px) |
| Page top padding | 16 + status-bar safe area |
| Page bottom padding | 96 mobile (clears bottom nav + FAB), 32 desktop |
| Gap between page header and content | 24 |
| Gap between cards / sections | 16 |
| Card inner padding | 20 |
| List-row padding | 10 vertical × 12 horizontal |
| Gap between rows in a list | 4 |
| Gap between form fields | 20 |
| Label → field | 6 |
| Sheet horizontal padding | 24 |

### 4.2 Layout grid

- **Mobile (default):** single column, full-bleed cards inside page padding.
- **≥ 768 px:** fixed 256 px navy sidebar, content column to the right. Content **should** cap at 960 px wide and stay left-aligned to the sidebar.
- Stat tiles use a 2-column grid with a 12 px gap. Category pickers use a 3-column grid with an 8 px gap. The calculator keypad uses a 5-column grid with a 6 px gap.
- Horizontal scrolling is allowed only for chip strips (budget alerts, filters). It must show a partial next chip as an affordance and hide the scrollbar.

### 4.3 Shape

| Radius | Value | Use |
|---|---|---|
| Small | 8 | Inline chips inside cards, small icon buttons, menu labels |
| Medium | 12 | Inputs, list rows, segmented controls, secondary buttons, icon tiles |
| Large | 16 | Cards, primary/submit buttons, hero, amount input |
| Sheet | 24 (top corners only) | Bottom sheets |
| Full | pill/circle | Chips, avatars, category icon circles, FAB |

### 4.4 Elevation and layering

Resting surfaces are flat: a 1 px `border` and no shadow. Shadows signal "this floats above the page".

| Layer (bottom → top) | Elevation |
|---|---|
| Page content, cards | None (border only) |
| Bottom nav / sidebar | None; top border on mobile |
| FAB and FAB menu | Large shadow |
| Sheet backdrop (black 50%, light blur) + bottom sheet | Extra-large shadow |
| Dialogs | Extra-large shadow, above sheets |
| Toasts | Above dialogs |
| Lock screen | Topmost. Covers everything, including toasts |

The lock screen **must** be the highest layer. No toast, sheet, or dialog may render financial content above it.

### 4.5 Iconography

- One icon family: Lucide, outline style, default stroke.
- Sizes: **16** inline/in rows, **18** in settings tiles and nav (desktop), **20** bottom nav, **24–26** FAB, **28** lock and empty-state glyphs.
- Icon-only controls **must** have an accessible label.
- Category icons come only from the curated category icon set; no free-form icons.

### 4.6 Amount

The amount is the most important component in the product.

- **One formatter.** All display amounts go through the canonical formatter: en-IN grouping (`₹1,23,456`), `₹X.XX L` from 1 lakh, `₹X.XX Cr` from 1 crore, no paise in display.
- **Full precision** (no L/Cr compaction) in amount inputs, edit sheets, confirmation dialogs, CSV export, and restore previews. People confirm exact values.
- **Short format** (`₹12.5k`, `₹1.2L`) only on chart axes and chart labels.
- **Sign and direction** in lists:
  - Income: `+₹1,200` in income color.
  - Expense: `−₹1,200` in spending color.
  - Savings: savings icon plus `₹1,200` in savings color.
  - Balances: leading minus when negative, no plus when positive.
- **Screen readers:** amounts are announced with meaning ("Expense, 1,200 rupees"), not glyphs.
- **Size step-down:** the hero amount steps down at 1 lakh and 1 crore so it never wraps or truncates.

---

## 5. Components

Every component below is reusable. Before building something new, check whether one of these fits. If it almost fits, extend it. Don't fork it.

### 5.1 App shell

- **Mobile:** content + fixed bottom navigation + FAB. See §6.
- **≥ 768 px:** navy sidebar with brand, five nav items, and a compact overview (Lifetime balance, this month's Income and Expenses) using the exact same labels and values as the Dashboard hero.
- The shell is never rendered behind the lock screen or onboarding in a way that exposes amounts.

### 5.2 Page header

- Left: eyebrow (label style, muted) above the page title (page-title style).
- Right: up to two controls, normally the **period selector** and at most one icon action (share, export, filter).
- Settings sub-pages replace the eyebrow with a **back button** (chevron + parent name) and use the page title for the sub-page name.

### 5.3 Period selector (month)

One component, used everywhere a screen is scoped to a month (Dashboard, Transactions, Budgets, Analysis).

- Pill on `muted` track: previous arrow · month label · next arrow.
- Tapping the label opens the **month picker sheet** (last 13 months, current month tagged "Current").
- The next arrow is disabled on the current month. Disabled is shown with reduced opacity **and** announced as disabled.
- The selected month persists while navigating between tabs in the same session.

### 5.4 Card

| Variant | Spec | Use |
|---|---|---|
| Standard | `card` surface, 1 px border, radius 16, padding 20 | Default container |
| List group | Standard with padding 0 and full-width dividers between rows | Settings groups, grouped lists |
| Hero | `hero` navy surface, radius 16, padding 20, white text | Dashboard balance only; max one per screen |
| Banner | Tint background of its status (§2.3), radius 12, padding 12–16, icon + one sentence + one action + dismiss | Month-end review prompt, Drive connection prompt, screen-level errors, unreadable-data notice |

- Card title uses the card-title style. Card-level actions sit at the top right as a text button or icon button. Never more than one primary action per card.
- **Unreadable-data notice** (`StorageNoticeBanner`, added 2026-11-11): an info Banner at the top of the page content after startup when records were quarantined (§8.2, ARCHITECTURE §8.3). It gives a count only, never record contents. Its only action is dismiss, because no in-app recovery exists yet. It is an instance of Banner, not a new component.
- **Startup error screen** (`StartupErrorScreen`, added 2026-11-11): the full-screen pattern from §8.2 for unreadable local data. Same layout as the lock screen (centered icon tile, title, one sentence, actions). The primary action is **Try again**. The only data-affecting action, **Continue without it**, is a ghost button behind a destructive confirmation dialog. Rationale: §8.2 requires a full-screen message and forbids overwriting data without explicit confirmation; no existing component covered it.

### 5.5 Balance hero

Order, top to bottom: eyebrow "Lifetime balance" → hero amount → optional "On your card" chip → one-line daily context ("Spent ₹X today · avg ₹Y/day") → divider → 2×2 stat tiles (Income, Expenses, Carry-forward, {Month} balance).

- The "On your card" chip (approved 2026-11-14, D11) appears once any card purchase or bill payment exists, including at ₹0. It is a button with a trailing chevron and a 48 px hit area; it opens the **card sheet** (§5.14 bottom sheet): "Still to pay" amount, a "Record a bill payment" form (amount with a "Paid in full" shortcut, date paid defaulting to today and not in the future, inline errors, busy state, status line after saving), and a "Card entries" list (newest 50; tap to edit). Empty state: "No card purchases yet…". Built from Sheet, Input, Button, and list rows; no new tokens.

- Stat tiles: micro label with a direction icon, then amount in the amount style using on-dark money colors.
- A negative {Month} balance gets a subtle red-tint tile background in addition to its color and minus sign.
- Text on navy uses at least 60% white opacity. 40–50% is too faint.

### 5.6 Stat tile

Label (micro or caption, muted) above the value (amount style). Optional direction icon before the label. Optional caption below ("from Oct 2026"). Tiles are not tappable unless they navigate, and then they show a chevron.

### 5.7 List row (transaction)

- 36 px category circle (category icon on its tint) → primary text (category name, body-strong) with optional secondary text (note, caption, single line) → amount (right-aligned, never truncated).
- Income rows may carry a 3 px income-color left rule. This is the only row-level color accent.
- Whole row is the tap target (opens the edit sheet). Minimum height 48 px.
- Rows are grouped under date headers (caption style, muted, 600 weight).
- Inactive categories in history show their name normally plus an "Inactive" micro badge.
- Card purchases show a "Card" badge after the category name. Card bill payments show the label "Card payment" and the amount in `foreground` without a sign (§2.2).

### 5.8 Settings row

40 px accent-tinted icon tile (radius 12) → title (body-strong) + one-line status description (caption) → chevron. The description reports live state ("App lock is on · biometrics enabled") instead of static marketing copy.

### 5.9 Progress bar

- Height 6 px, full radius, `muted` track.
- Fill color by status:
  - **Spending budgets:** category color below 75%, amber 75–99%, red at ≥100%.
  - **Savings and commitment budgets:** category color below 75%, amber 75–99%, green at ≥100%. Reaching or exceeding a savings or commitment target is never shown as an error.
- A non-zero value shows at least a 2% sliver; the fill caps visually at 100%.
- Always accompanied by text: "₹3,200 of ₹5,000 · ₹1,800 left" or "₹600 over".

### 5.10 Chip

| Variant | Use |
|---|---|
| Status chip | Pill, status tint (§2.3), 12 px semibold text, leading 14 px status icon (check, alert-triangle, alert-circle, target). Used for budget alerts. |
| Filter chip | Pill, unselected = border on card, selected = accent tint with accent text and a check icon. Multi- or single-select. |
| Badge | Small, radius 8, micro text, `muted` background. "Inactive", "Current", "Recurring", "Adjustment". |

Status chips replace emoji. Example: alert icon + "Food 82%"; over-limit icon + "Food +₹1,200 over"; check icon + "Emergency fund funded".

### 5.11 Segmented control

- `muted` track, radius 12, 4 px inset. Selected segment: radius 8 with a raised surface.
- **Neutral segments** (Analysis tabs, filters): selected is `card` surface with `foreground` text.
- **Transaction type toggle** (Expense / Income / Save): selected segment uses that type's fill with white text. This is the only segmented control with colored states.
- Switching type clears an incompatible category and keeps the amount, date, and note.

### 5.12 Buttons

| Variant | Spec | Use |
|---|---|---|
| Primary | Accent fill, white text, radius 12 (16 when full-width in a sheet), 48 px tall | The single main action of a screen or dialog |
| Typed submit | Full-width, 52–56 px, radius 16, fill = transaction type color | Entry sheet submit only |
| Secondary | Card surface, 1 px border, `foreground` text | Alternative actions |
| Ghost / text | No container, accent or muted text | Tertiary actions, "View all", "Forgot PIN?" |
| Destructive | Red 600 fill, white text | Confirm delete or reset inside a dialog only |
| Icon button | Visual 32–36 px circle or radius 12 square, **hit area 48 × 48 px** | Close, delete-in-sheet, share, steppers |

Button states:

- **Disabled:** muted fill and muted text. A disabled primary action must have a visible reason nearby ("Pick a category to continue").
- **Busy:** label changes to the in-progress verb ("Saving…", "Restoring…") with a 16 px spinner. Width is locked and taps are ignored.
- **Pressed:** scale to 0.97 plus a slight darkening. No ripple effects.

### 5.13 Floating action button (FAB)

- 56 px circle, accent fill, white plus icon, large shadow.
- Position: 20 px from the right edge, 16 px above the bottom nav (mobile); 32 px from the bottom-right corner (desktop). Add the gesture-bar safe area.
- **Single-action mode:** opens the screen's primary creation sheet. Label = the action.
- **Menu mode** (speed dial): plus rotates 45° to a close icon, black 40% backdrop, up to 4 mini actions (44 px circles) stacked upward, each with a text label to its left. Backdrop tap, Android back, or selecting an item closes it.
- The FAB is hidden on the lock screen, during onboarding, and while a sheet or dialog is open.
- The page bottom padding must keep the last list row fully visible above the FAB.

### 5.14 Bottom sheet

Primary pattern for create/edit and short pickers.

- Enters from the bottom; top corners radius 24; max height 92% of the viewport; internal scroll.
- **Sticky header:** title (sheet-title style) left; icon actions right (delete when editing, then close). Optional segmented control under the title.
- **Body:** fields at 20 px spacing, 24 px side padding.
- **Footer:** submit as the last element in the scroll on mobile. When the keyboard is open, the focused field and the submit button must remain reachable without dismissing the keyboard.
- Dismiss via close button, backdrop tap, swipe down, or Android back. If the form has unsaved changes, ask "Discard changes?" first.
- Focus moves into the sheet on open and returns to the trigger on close.

### 5.15 Confirmation dialog

Required for every destructive, overwriting, or irreversible action: delete transaction, delete budget, delete recurring rule, delete category, copy budgets onto an existing month, apply suggested budgets, restore backup, reset app data, disable PIN.

Template:

- **Title:** the action as a question. "Delete this transaction?"
- **Body:** what will change, in concrete terms, including amounts or counts. "₹1,200 · Food · 5 Nov 2026 will be removed. Balances and budgets for November will update." State irreversibility once, plainly.
- **Actions:** Cancel (secondary, left) and the specific verb (destructive or primary, right). Never "OK" or "Yes".
- High-severity actions (reset app data, restore that replaces local data) also list what is **not** affected or recoverable (for example, what the backup excludes) and use a destructive button.

### 5.16 Toast

- Bottom, above the nav and FAB, max two lines, auto-dismiss after 4 s (errors stay until dismissed).
- Used for confirmations of completed background-ish actions ("Backup saved to Google Drive", "3 recurring expenses added").
- Deleting a transaction or budget **should** offer "Undo" in the toast for 5 s.
- Never use a toast as the only place an error is reported for a form. The form shows the error inline.

### 5.17 Inputs

| Input | Spec |
|---|---|
| Text | `muted` fill, no border, radius 12, 48 px tall, 16 px horizontal padding, 14 px text. Focus = 2 px accent ring. |
| Amount | Large: `muted` fill, radius 16, leading ₹ glyph, entry-amount style, decimal keyboard. Accepts calculator expressions (`250+75`) and shows the evaluated result before save. Below it, the 5-column calculator keypad: 40 px keys, `=` key in accent. Keypad taps must not dismiss the system keyboard. |
| Date | Native date picker, defaults to today, displays in `5 Nov 2026` format. Future dates are allowed only where the PRD allows them. |
| Search | Leading search icon, clear button when not empty, searches category, note, and amount as the user types. |
| Category picker | 3-column grid of tiles (36 px category circle + name). Selected = accent border + accent tint. Final tile "New" (dashed border) expands an inline create form. Inactive categories are not offered for new entries; when editing a record whose category is inactive, show it selected with an "Inactive" badge. |
| Switch | Track 44 × 24, accent when on. The label sits to the left and describes the on state ("Lock app when it goes to the background"). |
| PIN | Four separate 48 × 56 slots, numeric keyboard, auto-advance, masked. Errors shake the group once and show text below. |
| Choice grid / radio | Bordered tiles or rows; selected = accent border + tint + check icon. |

### 5.18 Empty state

Inline inside the card or list it replaces. No illustration.

- 28 px muted icon (optional) → one-line title (body-strong): what's missing → one-line caption: the next step → optional single secondary button for that step.
- Example: "No transactions this month" / "Tap + to add your first one."

### 5.19 Skeleton

- `muted` blocks matching the final layout's sizes, radius matching the target, gentle 1.2 s opacity pulse (static under reduced motion).
- Used only where content takes more than ~300 ms (analysis panes, backup metadata). Local list reads should render directly.

### 5.20 Charts

- Always pair a chart with a text summary of the headline fact ("Food is 34% of spending, up ₹1,200 vs October").
- Legends list name, amount, and percentage. Tapping a segment or bar highlights it and shows exact values. Never rely on hover.
- When data is insufficient, replace the chart with an empty state explaining how much history is needed. Never draw a flat or zero chart that looks like real data.
- No 3D, no gradients, no animated count-up of totals.

---

## 6. Navigation

### 6.1 Structure

Five top-level destinations, in this fixed order:

1. **Dashboard**: snapshot
2. **Transactions**: history and entry
3. **Budgets**: monthly limits
4. **Analysis**: Overview / Planning / Trends
5. **Settings**: management hub → Categories, Recurring expenses, Savings, Security, Backup & Restore, Send feedback

SMS destinations are removed from navigation and settings (PRD FR-10).

### 6.2 Bottom navigation (mobile)

- Five equal items, icon (20 px) over label (micro, 11 px minimum), 56 px tall plus the gesture-bar safe area.
- **Active state:** accent icon and label, label weight 600, plus a 24 × 3 px accent indicator above the icon. Not color alone.
- Re-tapping the active item scrolls to top.
- The bar stays visible on all top-level screens, and remains visible (with Settings active) on Settings sub-pages.

### 6.3 Sidebar (≥ 768 px)

Same five items, same order and icons, 48 px rows, active = accent fill with white text.

### 6.4 Hierarchy and back behavior

- Settings sub-pages are one level deep with a header back button.
- **Android back** closes the topmost layer first, in order: FAB menu → dialog → sheet → sub-page → top-level tab returns to Dashboard → exit app.
- Cross-links (Dashboard alert chip → Budgets with that category highlighted; Budget row → filtered Transactions; Dashboard bucket row → Analysis) land with the target item scrolled into view and briefly highlighted (accent tint, fades over 1.5 s).

### 6.5 Overlays at launch

Priority order: **lock screen → onboarding → month-end review prompt**. Only one is visible at a time. The month-end review never auto-opens over the lock screen, onboarding, or an open sheet.

---

## 7. Forms

### 7.1 Structure

- Single column. Field order follows the user's mental order: **what kind → how much → what for → when → note**.
- Each field has a visible label (label style) above it. Optional fields say "(optional)"; required fields carry no asterisk.
- Use sensible defaults: today's date, the last-used type, the current month.
- Group related fields under a section label inside long forms (Savings targets, Recurring rule).

### 7.2 Validation

- Validate on submit and on blur after the first submit attempt. Never validate while the user is still typing their first value.
- Error message sits directly under the field: Red 600 caption with an alert icon and a sentence that tells the user how to fix it ("Enter an amount greater than ₹0").
- Errored fields get a 2 px red ring. On submit failure, focus moves to the first invalid field.
- **Must** preserve every entered value after a validation or save error (PRD FR-02).
- Disabled submit is acceptable only with a visible hint explaining what is missing.

### 7.3 Submission

- Submit enters the busy state immediately and ignores further taps. No duplicate records.
- On success: close the sheet, show the result in place (new row appears and totals update), and optionally show a toast.
- On failure: keep the sheet open with values intact, show an inline error banner at the top of the sheet: what failed, whether anything was saved, and what to try.
- Never report success before the data is durably saved.

### 7.4 Keyboard and input

- Amount uses the decimal keyboard. PIN uses the numeric keyboard. Text uses the default keyboard with sentence capitalization.
- The focused field scrolls into view above the keyboard. Sheets resize with the keyboard instead of being covered by it.
- "Next" on the keyboard moves through fields. "Done" on the last field submits if the form is valid.

### 7.5 Destructive and overwrite forms

- Copy-budgets and apply-suggestions flows list the exact categories that will be overwritten and the ones that will be untouched before confirmation (PRD FR-05, FR-08).
- Category Delete appears **only** for unused, non-system categories. Used categories show "Mark inactive" instead, with a caption explaining why ("Used in 24 transactions. Mark it inactive to hide it from new entries.").
- "Mark inactive" is refused while an active recurring expense uses the category; the error names the rules and asks the user to pause or move them first (owner decision 2026-11-12).

---

## 8. Loading, Empty, and Error States

### 8.1 General rules

| State | Rule |
|---|---|
| Loading < 300 ms | Show nothing extra. Avoid spinner flashes. |
| Loading 300 ms – 2 s | Skeleton for content; busy button for actions. |
| Loading > 2 s | Add a progress message describing the step ("Downloading backup…"). Determinate progress if available. |
| Empty | Inline empty state (§5.18) with the next step. |
| No matches | Distinct from empty: "No transactions match 'swiggy'" + "Clear filters". |
| Insufficient history | Explain the requirement ("Trends need at least 2 months of entries"). Never show 0%, ∞, or NaN. |
| Error | Say what happened, whether data is safe, and what to do next. Offer retry when retry can work. |
| Offline / unavailable capability | Explain the limit (connectivity, permission, device support) and keep the rest of the screen usable. |

### 8.2 Where errors appear

| Scope | Pattern |
|---|---|
| Single field | Inline under the field |
| Whole form / sheet | Error banner at top of the sheet |
| Whole screen or data source | Error banner at top of the page content |
| Background operation (backup, recurring processing, export) | Toast (persistent until dismissed) + status line in the related settings row |
| Unreadable local data at startup | Full-screen message. Do **not** offer actions that overwrite data without an explicit confirmation |

### 8.3 Context table

| Context | Loading | Empty | Error / recovery |
|---|---|---|---|
| Startup | Plain background in brand canvas color, no spinner unless > 1 s | Onboarding | Explain unreadable data; never silently reset |
| Transactions | Busy submit | "No transactions this month" / "No matches" | Inline + banner; values preserved |
| Categories | Busy save/toggle | "No active categories of this type. Create one or reactivate one." | Explain protected deletion |
| Budgets | Busy save/copy | "No budgets for November" + "Create budget" / "Copy from October" | Explain invalid limits or overwrite consequences |
| Analysis | Skeleton panes at final heights | "Not enough history yet" per card | No invalid percentages or forecasts |
| Recurring | Inline "Adding due expenses…" status if noticeable | "No recurring expenses" + example ("rent, EMIs, SIPs") | Report failure; never duplicate |
| Backup / restore | Step messages, determinate where possible | "No backup found in your Google Drive" | Local data untouched; say so explicitly |
| Import / export | Busy action | "No records in this range" | Invalid rows, skipped duplicates, share failure, each stated with counts |
| Unlock | Biometric "Checking…" | — | Wrong PIN message; cooldown countdown; reset warning |

---

## 9. Interaction and Motion

### 9.1 Principles

Motion explains where something came from and where it went. It is never decorative, never delays input, and never repeats on every visit.

### 9.2 Timing

| Token | Duration / curve | Use |
|---|---|---|
| Instant | 100 ms ease-out | Color, opacity, pressed states |
| Quick | 150–200 ms ease-out | Expand/collapse, inline forms, chip selection, tab indicator |
| Sheet | Spring (stiffness ~380, damping ~36), ≈ 300 ms | Bottom sheets in/out |
| Pop | Spring (stiffness ~420, damping ~22) | FAB appear, FAB menu items (40 ms stagger) |
| Entrance | 200 ms fade + 8 px rise, 40 ms stagger, max 5 items | Dashboard cards on **first** mount only |

### 9.3 Interaction rules

- **Press feedback:** scale to 0.97 on buttons and tappable cards. The FAB uses 0.9.
- **Swipe:** Analysis panes are swipeable horizontally with direction lock. Vertical scroll must never be hijacked. Tabs stay the primary control.
- **Pull-to-refresh:** not used. Data is local.
- **Long-press:** not used for essential actions. Every action must be reachable by tap.
- **Optimistic updates:** allowed for local saves only when failure is surfaced and rolled back visibly.
- **Highlight-on-arrival:** 1.5 s accent-tint fade for deep-linked items.
- **Error shake:** PIN group only, once, 350 ms.
- **Confetti:** reserved for completing a month-end review. Nowhere else.

### 9.4 Reduced motion

When the OS "remove animations" or reduced-motion setting is on, the app **must**:

- Replace springs, slides, and stagger with ≤ 150 ms opacity fades.
- Disable the shake, confetti, skeleton pulse, and swipe-momentum effects.
- Keep all information and state changes; only the motion is removed.

---

## 10. Responsive Behavior

| Range | Treatment |
|---|---|
| 320–359 px | Supported minimum. Stat tiles stay 2-up; hero amount steps down; month selector label may shorten to `Nov 2026`. |
| 360–430 px | Primary design target (common Android phones). |
| 431–767 px | Same mobile layout; sheets cap at 560 px wide and center. |
| ≥ 768 px | Sidebar layout; content max 960 px; dialogs centered; sheets remain bottom-anchored at max 560 px wide. |

- **Safe areas:** respect the status bar and gesture/navigation bar insets on every screen, the bottom nav, FAB, sheets, toasts, and the lock screen.
- **Landscape on phones:** supported, not optimized. Sheets scroll; the hero does not grow.
- **Text scaling:** layouts **must** remain usable at 130% system font size and **should** remain usable at 200%. Rows grow taller, labels wrap, and amounts step to a new line rather than truncate.
- **Keyboard open:** no fixed element (bottom nav, FAB) may cover the focused input. Hide the bottom nav and FAB while the keyboard is visible.

---

## 11. Content Rules for Finance

- Every number shown with a label must match the same number on every other screen for the same period (PRD §6, §12). If a screen needs a different definition, it gets a different label.
- Forecasts and estimates are labeled as estimates ("Estimated month-end balance") and show their basis ("based on your last 3 months").
- Backup copy says "backup" and "restore", never "sync". Restore copy always states that it replaces local data and what the backup excludes (PRD FR-11).
- App lock copy states that the lock does not encrypt stored data (PRD FR-12).
- Never imply advice: "You're on pace to exceed Food by ₹800", not "You should cut Food spending".

---

## 12. Accessibility Requirements

All items are **Must** unless marked.

### 12.1 Contrast

- Body and label text ≥ 4.5:1. Text at ≥ 18.7 px bold or ≥ 24 px regular ≥ 3:1.
- Icons, input boundaries, focus rings, progress fills, and chart segments ≥ 3:1 against their background.
- White text on colored fills uses only the fills listed in §2.2–2.4 (all ≥ 4.5:1). The 500-level green, red, and sky fills are not used behind text.
- Muted text is not placed on the `muted` fill for essential information.
- Text on the navy hero uses ≥ 60% white opacity.

### 12.2 Not color alone

- Money direction uses a sign or icon plus color.
- Budget status uses a text percentage or amount plus color; status chips include an icon and words.
- The active nav item has an indicator and weight change plus color.
- Errors use an icon and text plus red.

### 12.3 Touch and pointer

- Minimum touch target 48 × 48 dp. A smaller visual control gets padding to reach this.
- At least 8 dp between adjacent targets.
- No essential action is hidden behind hover, long-press, or swipe only.

### 12.4 Screen readers (TalkBack)

- Every icon-only button has a label describing the action ("Close", "Delete transaction", "Previous month").
- Transaction rows are announced as one unit: "Food, expense, 1,200 rupees, 5 November, note: lunch".
- Sheets and dialogs are announced as dialogs, trap focus while open, and return focus to the trigger on close.
- The lock screen is a modal dialog. Content behind it is hidden from assistive tech.
- Form errors, toasts, and busy/complete status changes are announced through a polite live region (assertive for blocking errors).
- Charts expose their text summary and legend values. Decorative shapes are hidden from assistive tech.
- Swipeable tab panes expose only the active panel.

### 12.5 Focus and keyboard

- A visible 2 px accent focus ring with 2 px offset on every interactive element (relevant to hardware keyboards and the browser build).
- Logical focus order matches visual order. Custom tappable rows are keyboard-activatable with Enter and Space.

### 12.6 Text and motion

- Supports system font scaling (§10).
- Minimum text size 11 px (§3.2).
- Reduced-motion compliance (§9.4).

---

## 13. Page-Level Layout Guidance

Each screen follows the shell, header, and spacing rules above. Listed in top-to-bottom order.

### 13.1 Onboarding and restore choice

- Full-screen, no nav, no FAB. Brand mark and wordmark at top.
- Short intro carousel (max 3 slides, text-led, skip always visible) → choice step with two equal-weight options: **Start fresh on this device** and **Connect Google Drive to restore**.
- The restore path previews backup metadata (date, record counts, size) before any confirmation. Copy explains that starting fresh does not delete anything already stored (PRD FR-01).

### 13.2 Lock screen

- Centered column, max 384 px: lock glyph in accent tile → "Fiscal Focus is locked" → instruction → PIN slots → error/cooldown line → "Use biometrics" secondary button (when enabled) → "Forgot PIN? Reset app data" ghost button.
- Biometric prompt auto-starts once. PIN is always available as a fallback.
- Reset uses a high-severity confirmation (§5.15) that lists exactly what is deleted.

### 13.3 Dashboard

1. Banners (month-end review, Drive connection): max one visible at a time, dismissible.
2. Header: "Overview" eyebrow, "Dashboard" title, period selector.
3. Balance hero (§5.5).
4. Budget alert chip strip (only when an alert exists).
5. "Where did your money go?": day-to-day / commitments / savings rows with progress bars and total outflow. Rows link to detail.
6. Recent transactions for the month, grouped by date, with "View all N transactions".

FAB: menu mode (Expense, Income, Save).

### 13.4 Transactions

1. Header with period selector and export action.
2. Search field.
3. Filter chips: All / Expense / Income / Savings, plus date range.
4. Result summary line ("42 transactions · −₹38,450") that describes exactly the records shown.
5. Date-grouped list (§5.7).

FAB: menu mode (Expense, Income, Save). Export labels state the exact range exported (PRD FR-02).

### 13.5 Transaction sheet (entry)

Title → type toggle → amount + calculator → category grid → date → note → **Paid with credit card** checkbox (Expense only; label plus one-line explanation; whole row is the 48 px tap target) → typed submit. Editing a card bill payment shows a short note instead of the checkbox. Editing adds the delete icon in the header. All rules from §5.14 and §7 apply.

### 13.6 Budgets

1. Header with period selector.
2. **Budget summary card** (`BudgetSummaryCard`, approved 2026-11-14, D11): "Budgets for {Month}", then one progress row (§5.9) each for Day-to-day, Commitments, and Savings ("₹X spent/paid/saved of ₹Y", then "₹Z left", "₹Z over", "₹Z to go", "Fully paid", or "Target met"), a "+ ₹N … in categories without a budget" line where it applies, and "All spending this month" at the bottom (equals Dashboard Expenses). Rationale: the old "Month Budget" and "Spent on budgeted" tiles and the Analysis "Spendable Budget" tile measured different things; one component from one domain summary keeps both screens identical. Bars use `accent`, or `destructive` when day-to-day is over; status is always in text.
3. Allocation strip: "Not yet budgeted · ₹X of ₹Y" (or "Budgeted ₹X more than you have"), "N% budgeted", and a caption explaining that available money is carry-forward plus the month's income and that limits include savings.
4. **Spending budgets** section: rows with category tile, name, spent/limit, progress bar, remaining or over amount.
5. **Savings budgets** section, visually separated with its own section label (PRD FR-05).
6. "Copy to {next month}" secondary action, which opens a confirmation listing overwrites.

Tapping a row opens that category's transactions. Editing a limit uses the budget sheet. Inline edit is acceptable only for the limit amount. FAB: "Add budget".

### 13.7 Analysis

1. Header with period selector and share action.
2. Segmented tabs: Overview / Planning / Trends (swipeable panes).
3. Each pane is a stack of standard cards. Each card has a title, a headline fact sentence, then the chart or table.

- **Overview:** budget summary (the same `BudgetSummaryCard` as Budgets, embedded in the "How am I doing this month?" card, followed by drill-down tiles for all day-to-day, commitment, and savings entries), category breakdown, budget vs actual, week comparison, rule-based alerts.
- **Planning:** upcoming recurring items, safe-to-spend estimate, projected month-end balance, savings pace, next-month suggestions (apply requires overwrite confirmation).
- **Trends:** daily activity, income/spending history, "What changed vs last month" (up to three increases and three decreases with ₹ and % change, "new" when there was nothing before; "Not enough history" when the previous period has no spending), and "Top 5 categories" (category-colored lines over the last six months plus a list with this month and the monthly average; the line appears once two months have entries). Savings rate, weekday pattern, and budget pace were removed on 2026-11-14 (D11).

Share exports the Overview pane as an image. Failures surface as a visible error (PRD FR-08).

### 13.8 Settings

Grouped list cards with section labels: **Manage** (Categories, Recurring expenses, Savings), **Privacy & Data** (Security, Backup & Restore), **Support** (Send feedback, What's New). The app version and a single-line footer go at the bottom. Each row shows live status (§5.8).

### 13.9 Categories

- Segmented control by classification (Expense / Income / Savings, as supported).
- **Active** list, then a collapsible **Inactive** section with badge and muted rows.
- Row: icon tile, name, usage count caption, overflow actions (Edit, Mark inactive/active, Delete when eligible).
- System categories show a lock icon and "System category" caption. They cannot be deleted.
- Create/edit uses a bottom sheet with name, type, icon grid, and color swatch grid.

### 13.10 Recurring expenses

- Summary line ("5 rules · 4 active · ₹42,300/month").
- Rule rows: description, category, amount, "Every month on day 31 (last day in shorter months)", status badge (Active/Paused), and a switch for pause/resume.
- Empty state uses a concrete example. Edit/delete sheet explains that existing generated transactions are kept (PRD FR-07).

### 13.11 Savings targets

Two cards, **Goal savings** and **Emergency fund**. Each has monthly and annual target inputs, a contribution progress bar for this month and this year, and recorded amounts. Copy distinguishes these global targets from monthly savings budgets (PRD FR-06).

### 13.12 Security

- App lock switch → PIN setup/change (requires current PIN) → biometrics switch (with unavailable-reason caption when unsupported) → lock-on-background switch.
- A persistent info note: "App lock hides your data on screen. It doesn't encrypt stored data."

### 13.13 Backup and restore

1. Google connection card: status, account, connect/disconnect. Disconnecting states that local and Drive data are kept.
2. Drive backup card: last backup time and result, "Back up now", auto-backup preference, "Restore from backup" (preview, then high-severity confirmation).
3. CSV card: Import and Export, with a caption that CSV is not a complete backup.
4. "What's not included in backups" disclosure list (PRD FR-11).

### 13.14 Month-end review

Existing flow (Look back → Card bill → Reconcile → Plan ahead) in a full-height sheet with a step indicator. The **Card bill** step (approved 2026-11-12, D8) appears only when the card had an unpaid amount or a bill payment that month: it shows the unpaid amount, an amount field with a "Paid in full" shortcut, an inline error for more than the unpaid amount, and a status line after saving. When bill payments were recorded after the month ended (for example from the Dashboard card sheet, D11), it lists them, explains they are not part of this month's bank balance, and limits the entry so they are not recorded twice. Reconcile shows a caption when its expected balance includes unpaid card purchases. Any further redesign is still pending (PRD FR-09); apply the tokens, type, and accessibility rules only.

Reconcile also asks for the combined actual savings and emergency-fund balance at month end, explains the tracked balance and the difference, and excludes separate savings from the expected bank figure. If savings are lower, the user selects spent or lost, or transferred back to bank. Saving records only the difference; a separate bank-gap adjustment requires its own explicit button. The user can save without a bank adjustment. Failed writes leave the inputs in place. A savings correction can be removed from Transactions after a confirmation that explains its effects.

### 13.15 Not found

Standard page: title "Page not found", one sentence, primary button "Go to Dashboard". No illustration.

### 13.16 What's New

Settings sub-page (`/settings/changelog`) listing release notes bundled with the app, newest first. Each release is a card with the date and version, then 1 to 4 short lines, each with a text badge **New** (accent tint) or **Fixed** (secondary). Badges carry text, so meaning does not rely on color (§12.2). If there are no notes, it shows an empty state card ("No updates yet"). Notes are static, so there is no loading or error state. Built from the existing card, settings-row, and page-header patterns; no new components or tokens. Entry rules are in AGENTS.md §13.1.

---

## 14. Governance

- New UI **must** be assembled from §5 components and §2–4 tokens. A new component or token needs a short rationale added to this file in the same change.
- Changes to money colors, the amount formatter, terminology, or confirmation rules affect trust across every screen. They require owner approval.
- Each release candidate is checked against §12 (accessibility) and §8 (states) on a real Android device at default and 130% font size.

---

## 15. Known Gaps Between This Spec and the Current Build

Recorded so they are fixed deliberately, not copied. None of these is authorized for implementation by this document alone.

| # | Area | Current build | Spec |
|---|---|---|---|
| G1 | Branding | **Resolved 2026-11-12.** Sidebar wordmark, page title, and share text read "Fiscal Focus" | "Fiscal Focus" (§1.4) |
| G2 | Contrast | **Partly resolved 2026-11-12:** the `destructive` token is Red 600 and the entry sheet's submit and type-toggle fills are 600-level. Still open: other 500-level fills and 600-level list amounts on white | 600/700 fills and text colors (§2.2, §2.4, §12.1) |
| G3 | Minimum text | **Resolved 2026-11-12.** All 9–10 px text and chart labels raised to 11 px; sidebar text on navy at 60% white. E2E DSN-001 checks every visible text node on the main screens | 11 px minimum; ≥ 60% white on navy (§3.2, §12.1) |
| G4 | Status chips | **Resolved 2026-11-12.** Dashboard budget chips use an icon plus words ("over by", "% used", "funded", "paid") | Icon + words (§5.10) |
| G5 | Thresholds | **Resolved 2026-11-12.** Savings bars and the Analysis budget pill warn at 75% | Single 75% threshold (§5.9) |
| G6 | Period selector | Dashboard uses arrow stepper; Analysis uses picker sheet | One combined component (§5.3) |
| G7 | Fonts | **Resolved 2026-11-12.** Inter 400–600 and Manrope 500–800 (latin + latin-ext, OFL) are bundled in `src/assets/fonts`; no font request leaves the device. Inter 700 renders at the nearest loaded weight | Bundled fonts; Inter max 600 (§3.1) |
| G8 | Amount formatting | **Resolved 2026-11-12** outside month-end: lists, cards, tiles, and Analysis use `formatAmount` (compact from 1 lakh); inputs, edit screens, and confirmations use `formatAmountFull`; charts use `formatAmountShort`. Month-end cards still use the full-precision alias (pending D8) | One canonical formatter (§4.6) |
| G9 | Safe areas | **Resolved in code 2026-11-12.** `viewport-fit=cover`; bottom navigation, FAB, and main content use `env(safe-area-inset-*)`. Needs a device check (notch and gesture bar) | Insets respected everywhere (§10) |
| G10 | Reduced motion | **Resolved 2026-11-12.** framer-motion `MotionConfig reducedMotion="user"` plus a global `prefers-reduced-motion` CSS rule | All motion (§9.4) |
| G11 | Touch targets | **Resolved 2026-11-12** for the entry sheet's close and delete buttons (32 px icon, 48 px hit area). Other small icon buttons still need an audit | 48 px hit area (§12.3) |
| G12 | Layering | **Resolved 2026-11-06.** Nothing else is rendered while the lock screen is shown | Lock screen topmost (§4.4) |
| G13 | Hard-coded colors | Raw hex and hsl values in components (hero, sheets, chips, nav) | Semantic tokens only (§2) |
| G14 | SMS | **Resolved 2026-11-11.** SMS settings row and route removed; the old route renders Not Found | Removed (PRD FR-10, §6.1) |
| G15 | Disabled submit | **Resolved 2026-11-12.** The entry sheet shows what is missing (amount, category) under the disabled button | Visible hint (§5.12, §7.2) |
| G16 | Share errors | **Resolved 2026-11-12.** Analysis share failure shows a toast; cancelling the share sheet shows nothing | Visible error (§13.7) |
