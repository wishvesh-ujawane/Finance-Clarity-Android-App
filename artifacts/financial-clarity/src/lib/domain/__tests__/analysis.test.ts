import { describe, expect, it } from 'vitest';
import {
  consumptionByDay,
  consumptionByWeekday,
  dayToDayPaceByDay,
  futureOutflow,
  monthsOfHistoryBefore,
  spendableBalance,
} from '../analysis';
import { commitmentCategoryIds, totalConsumption } from '../finance-metrics';
import { FIXTURE_CATEGORIES, FIXTURE_TODAY, FIXTURE_TRANSACTIONS, NOV } from './fixtures';

const tx = FIXTURE_TRANSACTIONS;

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

  it('weekday and daily breakdowns add up to consumption spending', () => {
    const { totals } = consumptionByWeekday(tx, NOV);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(totalConsumption(tx, NOV));
    const days = consumptionByDay(tx, NOV);
    expect(days[15].total).toBe(1000);
    expect(days[15].txns.map(t => t.id)).toEqual(['nov-card-buy']);
    expect(days[10]).toBeUndefined();
  });

  it('day-to-day pace leaves out commitments and generated recurring entries', () => {
    const withRecurring = [
      ...tx,
      { id: 'gen', type: 'expense' as const, amount: 700, categoryId: 'groceries', note: '', date: '2026-11-06', recurringRuleId: 'r', recurringMonth: NOV },
    ];
    const days = dayToDayPaceByDay(withRecurring, commitmentCategoryIds(FIXTURE_CATEGORIES), NOV);
    expect(Object.values(days).reduce((a, b) => a + b, 0)).toBe(3000 + 1000 + 500);
  });

  it('counts months of history before a month', () => {
    expect(monthsOfHistoryBefore(tx, NOV)).toBe(1);
    expect(monthsOfHistoryBefore(tx, '2026-10')).toBe(0);
  });
});
