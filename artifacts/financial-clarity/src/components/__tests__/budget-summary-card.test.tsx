import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetSummaryCard } from '@/components/BudgetSummaryCard';
import type { BudgetSummary } from '@/lib/domain/budgets';

const summary: BudgetSummary = {
  dayToDay: { limit: 100000, spent: 105000, unbudgeted: 17000, count: 8 },
  commitments: { limit: 61000, spent: 56577, unbudgeted: 0, count: 3 },
  savings: { limit: 32000, spent: 32000, unbudgeted: 0, count: 2 },
};

describe('BudgetSummaryCard', () => {
  it('shows each budget type with spent-of-limit, status, and spending outside budgets', () => {
    render(<BudgetSummaryCard summary={summary} monthLabel="November 2026" />);

    expect(screen.getByText('Budgets for November 2026')).toBeTruthy();
    expect(screen.getByTestId('budget-summary-dayToDay-status').textContent).toBe('₹5,000 over');
    expect(screen.getByTestId('budget-summary-dayToDay-unbudgeted').textContent).toMatch(/₹17,000 spent in categories without a budget/);
    expect(screen.getByTestId('budget-summary-commitments-status').textContent).toBe('₹4,423 to go');
    expect(screen.getByTestId('budget-summary-savings-status').textContent).toBe('Target met');
    // Day-to-day + commitments, including categories without a budget.
    expect(screen.getByTestId('budget-summary-total').textContent).toBe('₹1.79 L');
  });

  it('never shows a commitment above its limit as an error', () => {
    render(
      <BudgetSummaryCard
        summary={{ ...summary, commitments: { limit: 41000, spent: 41000, unbudgeted: 0, count: 1 } }}
        monthLabel="November 2026"
      />,
    );
    expect(screen.getByTestId('budget-summary-commitments-status').textContent).toBe('Fully paid');
  });

  it('says when there is nothing to show', () => {
    const empty = { limit: 0, spent: 0, unbudgeted: 0, count: 0 };
    render(<BudgetSummaryCard summary={{ dayToDay: empty, commitments: empty, savings: empty }} monthLabel="January 2026" />);
    expect(screen.getByTestId('budget-summary-empty')).toBeTruthy();
  });

  it('shows "No budget set" for a type that only has spending', () => {
    const empty = { limit: 0, spent: 0, unbudgeted: 0, count: 0 };
    render(
      <BudgetSummaryCard
        summary={{ dayToDay: { limit: 0, spent: 0, unbudgeted: 2500, count: 0 }, commitments: empty, savings: empty }}
        monthLabel="November 2026"
      />,
    );
    expect(screen.getByText('No budget set')).toBeTruthy();
    expect(screen.getByTestId('budget-summary-dayToDay-unbudgeted').textContent).toMatch(/₹2,500/);
  });
});
