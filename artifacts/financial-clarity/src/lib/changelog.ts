/**
 * In-app release notes shown on Settings → What's New.
 *
 * Every app change a user can notice adds a line at the top of `CHANGELOG_ENTRIES`
 * in the same change, without waiting for approval or a deployment (AGENTS.md §13.1):
 * the date, the app version, and 1–4 short plain-English lines saying what was
 * added or fixed. A full date gets a second entry with the same date.
 * Release notes ship with the app; nothing is stored on the device or fetched
 * from the network.
 */

export type ChangeKind = 'new' | 'fixed';

export interface ChangeItem {
  kind: ChangeKind;
  text: string;
}

export interface ChangelogEntry {
  /** Release date as a local `YYYY-MM-DD` date. */
  date: string;
  /** App version from package.json at release time. */
  version: string;
  changes: ChangeItem[];
}

export const MAX_CHANGES_PER_ENTRY = 4;
export const MAX_CHANGE_TEXT_LENGTH = 140;

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-11-14',
    version: '1.0.0',
    changes: [
      { kind: 'new', text: 'Tap the round picture at the top of Settings to open your profile with your Google name, email, and photo.' },
      { kind: 'new', text: 'Sign in to Google, refresh your profile, or disconnect, all from the Profile page.' },
      { kind: 'new', text: 'App lock and security settings now live inside your profile.' },
      { kind: 'fixed', text: 'Switching to another Google account no longer reuses the previous account\u2019s backup folder.' },
    ],
  },
  {
    date: '2026-11-14',
    version: '1.0.0',
    changes: [
      { kind: 'new', text: 'Tick \u201cPaid with credit card\u201d when you add an expense to keep track of what you owe on your card.' },
      { kind: 'new', text: 'Tap \u201cOn your card\u201d on the Dashboard to see what you still owe and record a card bill payment.' },
      { kind: 'fixed', text: 'Budgets and Analysis now show the same budget summary, including spending without a budget.' },
      { kind: 'new', text: 'Trends now shows what changed since last month and your top 5 categories.' },
    ],
  },
  {
    date: '2026-11-13',
    version: '1.0.0',
    changes: [
      { kind: 'fixed', text: 'Screens now fit small phones without cut-off text or buttons.' },
      { kind: 'new', text: 'Clearer colours for money in and out, and larger buttons that are easier to tap.' },
      { kind: 'fixed', text: 'The add-entry form works better with screen readers and keyboards.' },
    ],
  },
  {
    date: '2026-11-12',
    version: '1.0.0',
    changes: [
      { kind: 'new', text: 'What\u2019s New screen in Settings shows what changed in each update.' },
      { kind: 'new', text: 'Month-end review now includes a credit card bill step.' },
      { kind: 'fixed', text: 'Savings are kept separate from your bank balance when you reconcile.' },
      { kind: 'fixed', text: 'Card bill payments no longer count as spending, so totals match on every screen.' },
    ],
  },
  {
    date: '2026-11-06',
    version: '1.0.0',
    changes: [
      { kind: 'fixed', text: 'Nothing is shown behind the lock screen, and screenshots of the app are blocked.' },
      { kind: 'fixed', text: 'Categories that are in use can no longer be deleted.' },
      { kind: 'fixed', text: 'The app asks before replacing a larger Google Drive backup and keeps a copy first.' },
    ],
  },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidChangelogEntry(entry: ChangelogEntry): boolean {
  return (
    isValidDate(entry.date) &&
    entry.version.trim().length > 0 &&
    entry.changes.length > 0 &&
    entry.changes.length <= MAX_CHANGES_PER_ENTRY &&
    entry.changes.every(
      c =>
        (c.kind === 'new' || c.kind === 'fixed') &&
        c.text.trim().length > 0 &&
        c.text.length <= MAX_CHANGE_TEXT_LENGTH,
    )
  );
}

/** Valid entries only, newest release first. */
export function getChangelog(entries: ChangelogEntry[] = CHANGELOG_ENTRIES): ChangelogEntry[] {
  return entries.filter(isValidChangelogEntry).sort((a, b) => b.date.localeCompare(a.date));
}
