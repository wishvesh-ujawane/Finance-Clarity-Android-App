import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SmsOriginBadge } from '../SmsOriginBadge';
import type { Transaction } from '@/lib/types';

// jest-dom matchers are not wired for this project; plain DOM assertions only.

function baseTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't-1',
    type: 'expense',
    amount: 100,
    date: '2026-07-05',
    categoryId: 'groceries',
    note: 'test',
    ...overrides,
  };
}

describe('SmsOriginBadge', () => {
  it('renders nothing when transaction has no sourceSmsFingerprint', () => {
    const { container } = render(<SmsOriginBadge transaction={baseTxn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SMS pill when sourceSmsFingerprint is set', () => {
    const { getByText } = render(
      <SmsOriginBadge
        transaction={baseTxn({ sourceSmsFingerprint: 'abcdef1234567890' })}
      />,
    );
    // Label text comes from SMS_COPY.badge.label. Assert non-empty rather
    // than a hardcoded string so the copy layer stays free to evolve.
    expect(getByText(/./).textContent?.trim().length).toBeGreaterThan(0);
  });

  it('does not render pill when sourceSmsFingerprint is empty string', () => {
    const { container } = render(
      <SmsOriginBadge transaction={baseTxn({ sourceSmsFingerprint: '' })} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
