import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_ENTRIES,
  MAX_CHANGES_PER_ENTRY,
  getChangelog,
  isValidChangelogEntry,
  type ChangelogEntry,
} from '../changelog';

const entry = (overrides: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  date: '2026-11-12',
  version: '1.0.0',
  changes: [{ kind: 'new', text: 'Something new.' }],
  ...overrides,
});

describe('bundled release notes', () => {
  it('has at least one entry and every entry follows the release-note rules', () => {
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThan(0);
    for (const e of CHANGELOG_ENTRIES) {
      expect(isValidChangelogEntry(e), `invalid entry ${e.date}`).toBe(true);
    }
  });

  it('is kept newest first so the latest release is added at the top', () => {
    const dates = CHANGELOG_ENTRIES.map(e => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe('isValidChangelogEntry', () => {
  it('rejects bad dates', () => {
    expect(isValidChangelogEntry(entry({ date: '2026-13-01' }))).toBe(false);
    expect(isValidChangelogEntry(entry({ date: '2026-02-30' }))).toBe(false);
    expect(isValidChangelogEntry(entry({ date: '12/11/2026' }))).toBe(false);
  });

  it('rejects empty or too many changes', () => {
    expect(isValidChangelogEntry(entry({ changes: [] }))).toBe(false);
    const tooMany = Array.from({ length: MAX_CHANGES_PER_ENTRY + 1 }, () => ({ kind: 'fixed' as const, text: 'Fix.' }));
    expect(isValidChangelogEntry(entry({ changes: tooMany }))).toBe(false);
  });

  it('rejects blank text, overly long text, and a missing version', () => {
    expect(isValidChangelogEntry(entry({ changes: [{ kind: 'new', text: '  ' }] }))).toBe(false);
    expect(isValidChangelogEntry(entry({ changes: [{ kind: 'new', text: 'x'.repeat(200) }] }))).toBe(false);
    expect(isValidChangelogEntry(entry({ version: '' }))).toBe(false);
  });
});

describe('getChangelog', () => {
  it('drops invalid entries and sorts newest first', () => {
    const result = getChangelog([
      entry({ date: '2026-01-05' }),
      entry({ date: 'bad' }),
      entry({ date: '2026-03-01' }),
    ]);
    expect(result.map(e => e.date)).toEqual(['2026-03-01', '2026-01-05']);
  });
});
