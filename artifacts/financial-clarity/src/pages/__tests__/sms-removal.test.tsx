import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FinanceProvider } from '@/context/FinanceContext';
import { FabProvider } from '@/context/FabContext';
import { localDateStr } from '@/lib/finance-utils';
import Settings from '../Settings';
import Transactions from '../Transactions';

vi.mock('wouter', async importOriginal => {
  const actual = await importOriginal<typeof import('wouter')>();
  return {
    ...actual,
    Link: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@/context/SecurityContext', () => ({
  useSecurity: () => ({ isAppLockEnabled: false, settings: {} }),
}));

const legacyTransaction = {
  id: 'legacy-sms-transaction',
  type: 'expense',
  amount: 1250,
  categoryId: 'groceries',
  note: 'Legacy purchase',
  date: localDateStr(new Date()),
  paymentMethod: 'credit-card',
  merchant: 'Reliance Fresh',
  sourceSmsFingerprint: 'legacy-fingerprint',
};

function renderWithFinance(children: ReactNode) {
  return render(
    <FinanceProvider>
      <FabProvider>{children}</FabProvider>
    </FinanceProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('financial-clarity:transactions', JSON.stringify([legacyTransaction]));
});

describe('SMS removal', () => {
  it('removes SMS controls from transaction history while retaining legacy financial entries', () => {
    renderWithFinance(<Transactions />);

    expect(screen.queryByText(/sms/i)).toBeNull();
    expect(screen.getByText('Legacy purchase')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });

  it('removes the SMS settings entry', () => {
    renderWithFinance(<Settings />);

    expect(screen.queryByText(/sms/i)).toBeNull();
    expect(screen.getByText('Recurring Expenses')).toBeTruthy();
  });
});
