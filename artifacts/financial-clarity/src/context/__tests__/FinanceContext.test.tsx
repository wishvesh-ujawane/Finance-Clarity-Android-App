import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import type { ReactNode } from 'react';

// Wrapper component for hooks
function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

describe('FinanceContext', () => {
  it('provides initial state', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    expect(result.current.transactions).toEqual([]);
    expect(result.current.categories.length).toBeGreaterThan(0); // Has default categories + savings
    expect(result.current.budgets).toEqual([]);
    expect(result.current.selectedMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('adds a transaction', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 100,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Test expense',
      });
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].note).toBe('Test expense');
    expect(result.current.transactions[0].amount).toBe(100);
  });

  it('adds a budget', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.addBudget({
        categoryId: 'groceries',
        limit: 5000,
        month: '2026-07',
      });
    });

    expect(result.current.budgets).toHaveLength(1);
    expect(result.current.budgets[0].limit).toBe(5000);
  });

  it('updates selectedMonth', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.setSelectedMonth('2026-05');
    });

    expect(result.current.selectedMonth).toBe('2026-05');
  });

  it('calculates month summary correctly', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    // Add income transaction
    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 50000,
        date: '2026-07-01',
        categoryId: 'salary',
        note: 'Salary',
      });
    });

    // Add expense transaction
    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Groceries',
      });
    });

    const summary = result.current.getMonthSummary('2026-07');
    
    expect(summary.totalIncome).toBe(50000);
    expect(summary.totalExpenses).toBe(5000);
    expect(summary.netFlow).toBe(45000);
    expect(summary.hasData).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 4b: SMS auto-import state machine
// ---------------------------------------------------------------------------
//
// These tests exercise runSmsScan / approveSms / dismissSms / link /
// unlink / dismissSmsBefore against the shipped FIXTURE_SMSES from
// mockSmsReader. Time is frozen at 2026-07-20 so a 30-day scan window
// covers all 15 fixtures (13 parseable, 2 rejected by parser).
//
// The mock reader is what getSmsReader() returns on non-Android platforms
// (vitest runs in jsdom -> Capacitor.getPlatform() === 'web').

describe('FinanceContext -- SMS auto-import', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T12:00:00+05:30'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first-scan populates pendingSms from FIXTURE_SMSES', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    let scanResult: Awaited<ReturnType<typeof result.current.runSmsScan>> | undefined;
    await act(async () => {
      scanResult = await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });

    expect(scanResult?.ok).toBe(true);
    if (scanResult?.ok) {
      // 13 parseable fixtures - autoLinked (0, no existing txns to match).
      expect(scanResult.newCandidates).toBeGreaterThan(0);
      expect(scanResult.autoLinked).toBe(0);
    }
    expect(result.current.pendingSmsCount).toBeGreaterThan(0);
    expect(result.current.lastScanMs).toBeGreaterThan(0);
  });

  it('second-scan is idempotent (0 new after first-scan)', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const firstCount = result.current.pendingSmsCount;
    expect(firstCount).toBeGreaterThan(0);

    let second: Awaited<ReturnType<typeof result.current.runSmsScan>> | undefined;
    await act(async () => {
      second = await result.current.runSmsScan({ sinceDays: 30, mode: 'incremental' });
    });

    expect(second?.ok).toBe(true);
    if (second?.ok) {
      expect(second.newCandidates).toBe(0);
    }
    // Pending set unchanged.
    expect(result.current.pendingSmsCount).toBe(firstCount);
  });

  it('auto-links a first-scan SMS to an existing matching transaction', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    // Pre-seed a manual expense that mirrors msg-001 (HDFC debit Rs 1250 at
    // Reliance Fresh on 05-Jul-26). The reconciler should high-confidence
    // match on amount+date and auto-link this SMS instead of adding a
    // duplicate row to pendingSms.
    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 1250,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Reliance Fresh',
      });
    });
    const seededId = result.current.transactions[0].id;

    let scanResult: Awaited<ReturnType<typeof result.current.runSmsScan>> | undefined;
    await act(async () => {
      scanResult = await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });

    expect(scanResult?.ok).toBe(true);
    if (scanResult?.ok) {
      expect(scanResult.autoLinked).toBeGreaterThanOrEqual(1);
    }

    // The seeded transaction should now carry a sourceSmsFingerprint stamp.
    const seeded = result.current.transactions.find(t => t.id === seededId);
    expect(seeded?.sourceSmsFingerprint).toBeTruthy();
    expect(result.current.linkedSmsCount).toBeGreaterThanOrEqual(1);
  });

  it('approveSms creates transactions with sourceSmsFingerprint and paymentMethod', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const before = result.current.transactions.length;
    const fingerprints = result.current.pendingSms.map(p => p.fingerprint);
    expect(fingerprints.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.approveSms(fingerprints.slice(0, 3));
    });

    expect(result.current.transactions.length).toBe(before + 3);
    const approved = result.current.transactions.filter(t => t.sourceSmsFingerprint);
    expect(approved.length).toBeGreaterThanOrEqual(3);
    for (const txn of approved.slice(0, 3)) {
      // Every approved SMS transaction must carry the fingerprint stamp.
      expect(txn.sourceSmsFingerprint).toMatch(/[0-9a-f]{16,}/);
    }
    // Pending set shrinks.
    expect(result.current.pendingSmsCount).toBe(fingerprints.length - 3);
  });

  it('credit-card-payment approvals do NOT inflate getTotalExpenses', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });

    // Find the credit-card-payment candidate (msg-005 in fixtures).
    const ccPayment = result.current.pendingSms.find(
      p => p.paymentMethod === 'credit-card-payment',
    );
    expect(ccPayment).toBeDefined();
    const beforeExpenses = result.current.getTotalExpenses('2026-07');

    await act(async () => {
      await result.current.approveSms([ccPayment!.fingerprint]);
    });

    const afterExpenses = result.current.getTotalExpenses('2026-07');
    // isConsumptionExpense excludes credit-card-payment, so totals must
    // be byte-identical after approving that specific SMS.
    expect(afterExpenses).toBe(beforeExpenses);
  });

  it('dismissSms moves fingerprint to dismissed set; re-scan skips it', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const targetFp = result.current.pendingSms[0].fingerprint;
    const beforeCount = result.current.pendingSmsCount;

    act(() => {
      result.current.dismissSms([targetFp]);
    });

    expect(result.current.pendingSmsCount).toBe(beforeCount - 1);
    expect(
      result.current.pendingSms.some(p => p.fingerprint === targetFp),
    ).toBe(false);

    // Re-scan (still first-scan since lastScanMs > 0 doesn't clear the
    // dismissed list). Dismissed fingerprint must not reappear.
    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    expect(
      result.current.pendingSms.some(p => p.fingerprint === targetFp),
    ).toBe(false);
  });

  it('link -> unlink round-trip restores SMS to pendingSms', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const parsed = result.current.pendingSms[0];
    const beforePendingCount = result.current.pendingSmsCount;

    // Seed a manual transaction to link into.
    act(() => {
      result.current.addTransaction({
        type: parsed.direction === 'credit' ? 'income' : 'expense',
        amount: parsed.amount,
        date: parsed.dateISO,
        categoryId: 'other',
        note: 'manual entry',
      });
    });
    const txnId = result.current.transactions[result.current.transactions.length - 1].id;

    act(() => {
      result.current.linkSmsToTransaction(parsed.fingerprint, txnId);
    });

    const linked = result.current.transactions.find(t => t.id === txnId);
    expect(linked?.sourceSmsFingerprint).toBe(parsed.fingerprint);
    expect(result.current.pendingSmsCount).toBe(beforePendingCount - 1);

    act(() => {
      result.current.unlinkSmsFromTransaction(parsed.fingerprint);
    });

    // Fingerprint cleared, SMS back in pending.
    const unlinked = result.current.transactions.find(t => t.id === txnId);
    expect(unlinked?.sourceSmsFingerprint).toBeFalsy();
    expect(result.current.pendingSmsCount).toBe(beforePendingCount);
    expect(
      result.current.pendingSms.some(p => p.fingerprint === parsed.fingerprint),
    ).toBe(true);
  });

  it('persists pendingSms / dismissedSmsFingerprints / lastScanMs across mount cycles', async () => {
    const first = renderHook(() => useFinance(), { wrapper });

    await act(async () => {
      await first.result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const targetFp = first.result.current.pendingSms[0].fingerprint;
    act(() => {
      first.result.current.dismissSms([targetFp]);
    });
    const persistedPending = first.result.current.pendingSmsCount;
    const persistedLastScan = first.result.current.lastScanMs;

    first.unmount();

    // Remount fresh; state rehydrates synchronously from localStorage in the
    // provider's initial state factory, so no waitFor is needed (and waitFor
    // fights with the fake timers this describe block uses).
    const second = renderHook(() => useFinance(), { wrapper });

    expect(second.result.current.lastScanMs).toBe(persistedLastScan);
    expect(second.result.current.pendingSmsCount).toBe(persistedPending);
    // Dismissed fingerprint stayed dismissed -> a re-scan doesn't bring it
    // back.
    await act(async () => {
      await second.result.current.runSmsScan({ sinceDays: 30, mode: 'incremental' });
    });
    expect(
      second.result.current.pendingSms.some(p => p.fingerprint === targetFp),
    ).toBe(false);
  });

  it('getLinkedTransactions returns only transactions with sourceSmsFingerprint', async () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    // No SMS activity yet: linkedSmsCount == 0.
    expect(result.current.linkedSmsCount).toBe(0);
    expect(result.current.getLinkedTransactions()).toEqual([]);

    await act(async () => {
      await result.current.runSmsScan({ sinceDays: 30, mode: 'first' });
    });
    const parsed = result.current.pendingSms[0];
    await act(async () => {
      await result.current.approveSms([parsed.fingerprint]);
    });

    const linked = result.current.getLinkedTransactions();
    expect(linked.length).toBeGreaterThanOrEqual(1);
    for (const t of linked) {
      expect(t.sourceSmsFingerprint).toBeTruthy();
    }
  });
});
