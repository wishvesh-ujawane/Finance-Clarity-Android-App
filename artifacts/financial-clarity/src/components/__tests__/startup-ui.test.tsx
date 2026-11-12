import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartupErrorScreen } from '../StartupErrorScreen';
import { StorageNoticeBanner } from '../StorageNoticeBanner';

describe('StartupErrorScreen', () => {
  it('explains the problem, says nothing changed, and retries', () => {
    const onRetry = vi.fn();
    render(<StartupErrorScreen problem="newer-version" onRetry={onRetry} />);

    expect(screen.getByRole('heading', { name: 'Update Fiscal Focus' })).toBeTruthy();
    expect(screen.getByText(/Nothing was changed/)).toBeTruthy();
    expect(screen.queryByTestId('startup-continue')).toBeNull();

    fireEvent.click(screen.getByTestId('startup-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('continues only after explicit confirmation', () => {
    const onContinue = vi.fn();
    render(<StartupErrorScreen problem="unpreserved" onRetry={vi.fn()} onContinue={onContinue} />);

    fireEvent.click(screen.getByTestId('startup-continue'));
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText(/permanently replaced/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('startup-continue-confirm'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('StorageNoticeBanner', () => {
  it('renders nothing when no data was quarantined', () => {
    const { container } = render(<StorageNoticeBanner reports={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the total count of unreadable records and can be dismissed', () => {
    render(
      <StorageNoticeBanner
        reports={[
          { key: 'transactions', invalidCount: 2, preserved: true },
          { key: 'budgets', invalidCount: 1, preserved: true },
        ]}
      />,
    );

    expect(screen.getByTestId('storage-notice-banner').textContent).toContain('3 saved records couldn\u2019t be read');
    expect(screen.getByText(/original data was kept/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('storage-notice-banner')).toBeNull();
  });

  it('uses general wording when a whole key was unreadable', () => {
    render(<StorageNoticeBanner reports={[{ key: 'savingsGoal', invalidCount: null, preserved: true }]} />);
    expect(screen.getByTestId('storage-notice-banner').textContent).toContain('Part of your saved data');
  });
});
