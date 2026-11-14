import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import { useAnalysisShared } from '@/components/analysis/useAnalysisShared';
import {
  FIXTURE_BUDGETS,
  FIXTURE_CATEGORIES,
  FIXTURE_TRANSACTIONS,
  NOV,
} from '@/lib/domain/__tests__/fixtures';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

/** PRD §14.2: equivalent totals agree across screens for the same period. */
describe('cross-screen consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 10, 0));
    localStorage.clear();
    localStorage.setItem('financial-clarity:transactions', JSON.stringify(FIXTURE_TRANSACTIONS));
    localStorage.setItem('financial-clarity:categories', JSON.stringify(FIXTURE_CATEGORIES));
    localStorage.setItem('financial-clarity:budgets', JSON.stringify(FIXTURE_BUDGETS));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render() {
    const { result } = renderHook(() => ({ finance: useFinance(), analysis: useAnalysisShared() }), { wrapper });
    return result.current;
  }

  it('Dashboard, Analysis, and the month summary report the same month totals', () => {
    const { finance, analysis } = render();
    expect(finance.selectedMonth).toBe(NOV);
    const summary = finance.getMonthSummary(NOV);

    expect(finance.getTotalIncome(NOV)).toBe(60000);
    expect(summary.totalIncome).toBe(60000);
    expect(analysis.monthlyIncome).toBe(60000);

    expect(finance.getTotalExpenses(NOV)).toBe(19500);
    expect(summary.totalExpenses).toBe(19500);
    expect(analysis.monthlyExpenses).toBe(19500);

    expect(finance.getTotalSavings(NOV)).toBe(4000);
    expect(analysis.monthlySavings).toBe(4000);

    expect(finance.getBalance(NOV)).toBe(36500);
    expect(summary.netFlow).toBe(36500);
  });

  it('commitments and day-to-day add up to consumption on every screen', () => {
    const { finance, analysis } = render();
    expect(finance.getTotalCommitments(NOV)).toBe(15000);
    expect(analysis.monthlyCommitments).toBe(15000);
    expect(finance.getTotalDayToDay(NOV)).toBe(4500);
    expect(analysis.monthlyDayToDay).toBe(4500);
    expect(analysis.monthlyDayToDayToDate + analysis.monthlyCommitmentsToDate).toBe(analysis.monthlyExpensesToDate);
    expect(analysis.monthlyExpensesToDate).toBe(19000);
  });

  it('the Analysis category breakdown adds up to consumption spending', () => {
    const { finance, analysis } = render();
    const total = analysis.allCategorySpending.reduce((sum, row) => sum + row.amount, 0);
    expect(total).toBe(finance.getTotalExpenses(NOV));
  });

  it('budget progress uses the same spent amount as the category metric', () => {
    const { finance } = render();
    expect(finance.getSpentForCategory('groceries', NOV)).toBe(4500);
    expect(finance.getSpentForCategory('savings-emergency', NOV)).toBe(4000);
    const breakdown = finance.getBudgetBreakdown(NOV);
    expect(breakdown.dayToDay.spent).toBe(4500);
    expect(breakdown.commitments.spent).toBe(15000);
    expect(breakdown.savings.spent).toBe(4000);
  });

  it('Budgets and Analysis read the same budget summary, which adds up to Dashboard totals', () => {
    const { finance, analysis } = render();
    const breakdown = finance.getBudgetBreakdown(NOV);
    expect(analysis.budgetBreakdown).toEqual(breakdown);
    expect(breakdown.dayToDay.spent + breakdown.dayToDay.unbudgeted).toBe(finance.getTotalDayToDay(NOV));
    expect(breakdown.commitments.spent + breakdown.commitments.unbudgeted).toBe(finance.getTotalCommitments(NOV));
    expect(breakdown.savings.spent + breakdown.savings.unbudgeted).toBe(finance.getTotalSavings(NOV));
  });

  it('balances agree with the PRD §6 definitions', () => {
    const { finance } = render();
    expect(finance.getCarryForward(NOV)).toBe(33000);
    expect(finance.getNetBalanceToDate()).toBe(74000);
    expect(finance.getCumulativeNetBalanceThroughEndOf(NOV)).toBe(73500);
    expect(finance.getOutstandingCardBalance()).toBe(500);
  });
});
