import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FinanceProvider } from '@/context/FinanceContext';
import Changelog, { ChangelogView } from '../Changelog';
import Settings from '../Settings';

vi.mock('wouter', async importOriginal => {
  const actual = await importOriginal<typeof import('wouter')>();
  return {
    ...actual,
    Link: ({ children, href, ...rest }: { children: ReactNode; href?: string }) => <a href={href} {...rest}>{children}</a>,
  };
});

vi.mock('@/context/SecurityContext', () => ({
  useSecurity: () => ({ isAppLockEnabled: false, settings: {} }),
}));

vi.mock('@/context/BackupContext', () => ({
  useBackup: () => ({ user: null }),
}));

describe('Changelog page', () => {
  it('is reachable from Settings', () => {
    localStorage.clear();
    render(
      <FinanceProvider>
        <Settings />
      </FinanceProvider>,
    );
    expect(screen.getByTestId('settings-changelog-link')).toBeTruthy();
  });

  it('lists releases newest first with dated New and Fixed lines', () => {
    render(
      <ChangelogView
        entries={[
          {
            date: '2026-03-01',
            version: '1.2.0',
            changes: [
              { kind: 'new', text: 'Added a thing.' },
              { kind: 'fixed', text: 'Fixed a thing.' },
            ],
          },
          { date: '2026-01-05', version: '1.1.0', changes: [{ kind: 'fixed', text: 'Older fix.' }] },
        ]}
      />,
    );

    const items = screen.getAllByTestId('changelog-entry');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('v1.2.0')).toBeTruthy();
    expect(within(items[0]).getByText(/1 Mar 2026/)).toBeTruthy();
    expect(within(items[0]).getByText('New')).toBeTruthy();
    expect(within(items[0]).getByText('Fixed')).toBeTruthy();
    expect(within(items[0]).getByText('Added a thing.')).toBeTruthy();
    expect(within(items[1]).getByText('Older fix.')).toBeTruthy();
    expect(screen.queryByTestId('changelog-empty')).toBeNull();
  });

  it('shows every entry when one date has more than one entry', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ChangelogView
          entries={[
            { date: '2026-03-01', version: '1.2.0', changes: [{ kind: 'new', text: 'First batch.' }] },
            { date: '2026-03-01', version: '1.2.0', changes: [{ kind: 'new', text: 'Second batch.' }] },
          ]}
        />,
      );

      const items = screen.getAllByTestId('changelog-entry');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByText('First batch.')).toBeTruthy();
      expect(within(items[1]).getByText('Second batch.')).toBeTruthy();
      expect(consoleError.mock.calls.some(args => String(args[0]).includes('same key'))).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shows an empty state when there are no release notes', () => {
    render(<ChangelogView entries={[]} />);
    expect(screen.getByTestId('changelog-empty')).toBeTruthy();
    expect(screen.getByText('No updates yet')).toBeTruthy();
  });

  it('renders the bundled release notes by default', () => {
    render(<Changelog />);
    expect(screen.getAllByTestId('changelog-entry').length).toBeGreaterThan(0);
  });
});
