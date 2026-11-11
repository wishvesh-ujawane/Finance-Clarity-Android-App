import { expect, test, type Page } from '@playwright/test';

function monthKey(offset: number) {
  const d = new Date();
  const shifted = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

async function prepare(page: Page, data: Record<string, unknown>) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(seed => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value));
  }, data);
}

test('[ANA-001] Planning says "insufficient history" instead of projecting from one month', async ({ page }) => {
  const thisMonth = monthKey(0);
  await prepare(page, {
    'financial-clarity:transactions': [
      { id: 'e2e-salary', type: 'income', amount: 50000, categoryId: 'salary', note: '', date: `${thisMonth}-01` },
      { id: 'e2e-food', type: 'expense', amount: 1200, categoryId: 'groceries', note: '', date: `${thisMonth}-01` },
    ],
  });

  await page.goto('/analysis');
  await page.getByRole('tab', { name: 'Planning' }).click();
  await expect(page.getByTestId('projected-balance-insufficient')).toContainText('Insufficient history');
  await expect(page.getByTestId('projected-balance-card')).toHaveCount(0);
});

test('[ANA-002] budget suggestions ask before replacing an existing limit', async ({ page }) => {
  const thisMonth = monthKey(0);
  const nextMonth = monthKey(1);
  await prepare(page, {
    'financial-clarity:transactions': [
      { id: 'e2e-food', type: 'expense', amount: 1000, categoryId: 'groceries', note: '', date: `${thisMonth}-01` },
    ],
    'financial-clarity:budgets': [
      { id: 'e2e-next', categoryId: 'groceries', limit: 300, month: nextMonth },
    ],
  });

  await page.goto('/analysis');
  await page.getByRole('tab', { name: 'Planning' }).click();
  await page.getByTestId('apply-suggestions').click();
  const dialog = page.getByTestId('suggestions-confirm-dialog');
  await expect(dialog).toContainText('Groceries ₹300 → ₹1,100');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  const unchanged = await page.evaluate(() => JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]'));
  expect(unchanged[0].limit).toBe(300);

  await page.getByTestId('apply-suggestions').click();
  await page.getByTestId('suggestions-confirm').click();
  await page.waitForFunction(next =>
    JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]')
      .some((b: { month: string; limit: number }) => b.month === next && b.limit === 1100), nextMonth);
});
