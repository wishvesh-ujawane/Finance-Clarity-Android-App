import { describe, expect, it } from 'vitest';
import {
  categorySpendChanges,
  consumptionByDay,
  futureOutflow,
  monthsOfHistoryBefore,
  spendableBalance,
  topCategoryTrend,
} from '../analysis';
import { totalConsumption } from '../finance-metrics';
import { FIXTURE_TODAY, FIXTURE_TRANSACTIONS, NOV } from './fixtures';

const tx = FIXTURE_TRANSACTIONS;
const OCT = '2026-10';

describe('analysis selectors', () => {
  it('spendable balance leaves out savings and does not count card bill payments', () => {
    const october = 50000 - 15000 - 2000 - 5000;
    const novemberToDate = 60000 - 3000 - 15000 - 1000 - 4000;
    expect(spendableBalance(tx, FIXTURE_TODAY)).toBe(october + novemberToDate);
  });

  it('future outflow counts later consumption and savings in the month only', () => {
    expect(futureOutflow(tx, NOV, FIXTURE_TODAY)).toBe(500);
    expect(futureOutflow(tx, NOV, '2026-11-09')).toBe(4000 + 1000 + 500);
  });

  it('daily breakdown adds up to consumption spending', () => {
    const days = consumptionByDay(tx, NOV);
    expect(Object.values(days).reduce((sum, d) => sum + d.total, 0)).toBe(totalConsumption(tx, NOV));
    expect(days[15].total).toBe(1000);
    expect(days[15].txns.map(t => t.id)).toEqual(['nov-card-buy']);
    expect(days[10]).toBeUndefined();
  });

  it('counts months of history before a month', () => {
    expect(monthsOfHistoryBefore(tx, NOV)).toBe(1);
    expect(monthsOfHistoryBefore(tx, '2026-10')).toBe(0);
  });
});

describe('category spend changes (Trends)', () => {
  const fullNov = { start: '2026-11-01', end: '2026-11-30' };
  const fullOct = { start: '2026-10-01', end: '2026-10-31' };

  it('compares consumption per category and leaves out unchanged categories, savings, and card bill payments', () => {
    expect(categorySpendChanges(tx, fullNov, fullOct)).toEqual([
      { categoryId: 'groceries', current: 4500, previous: 2000, change: 2500, changePct: 125 },
    ]);
  });

  it('compares the same days when the month is in progress', () => {
    const rows = categorySpendChanges(tx, { start: '2026-11-01', end: '2026-11-15' }, { start: '2026-10-01', end: '2026-10-15' });
    expect(rows).toEqual([{ categoryId: 'groceries', current: 4000, previous: 2000, change: 2000, changePct: 100 }]);
  });

  it('sorts increases first and reports no percentage for a category that is new', () => {
    const extra = [
      ...tx,
      { id: 'nov-dining', type: 'expense' as const, amount: 800, categoryId: 'dining', note: '', date: '2026-11-04' },
      { id: 'oct-fuel', type: 'expense' as const, amount: 600, categoryId: 'fuel', note: '', date: '2026-10-04' },
    ];
    const rows = categorySpendChanges(extra, fullNov, fullOct);
    expect(rows.map(r => r.categoryId)).toEqual(['groceries', 'dining', 'fuel']);
    expect(rows[1]).toMatchObject({ change: 800, changePct: null });
    expect(rows[2]).toMatchObject({ change: -600, changePct: -100 });
  });
});

describe('top category trend (Trends)', () => {
  it('picks the largest categories across the months and fills missing months with zero', () => {
    const trend = topCategoryTrend(tx, [OCT, NOV]);
    expect(trend.categoryIds).toEqual(['rent', 'groceries']);
    expect(trend.totals).toEqual({ rent: 30000, groceries: 6500 });
    expect(trend.points).toEqual([
      { month: OCT, values: { rent: 15000, groceries: 2000 } },
      { month: NOV, values: { rent: 15000, groceries: 4500 } },
    ]);
  });

  it('respects the limit and returns nothing when there is no spending', () => {
    expect(topCategoryTrend(tx, [OCT, NOV], 1).categoryIds).toEqual(['rent']);
    const empty = topCategoryTrend(tx, ['2026-01']);
    expect(empty.categoryIds).toEqual([]);
    expect(empty.points).toEqual([{ month: '2026-01', values: {} }]);
  });
});
