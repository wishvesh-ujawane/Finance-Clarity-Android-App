import { expect, test, type Page } from '@playwright/test';

function monthKey(offset: number) {
  const d = new Date();
  const shifted = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

async function prepare(page: Page, seed: (args: { thisMonth: string; nextMonth: string; today: string }) => void) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  const now = new Date();
  const args = {
    thisMonth: monthKey(0),
    nextMonth: monthKey(1),
    today: `${monthKey(0)}-${String(now.getDate()).padStart(2, '0')}`,
  };
  await page.addInitScript(([fn, a]) => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    // eslint-disable-next-line no-new-func
    new Function('args', `(${fn})(args)`)(a);
  }, [seed.toString(), args] as const);
}

test('[TXN-002] Transactions shows consumption as "Spending" and a double tap saves once', async ({ page }) => {
  await prepare(page, ({ today }) => {
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-food', type: 'expense', amount: 300, categoryId: 'groceries', note: 'E2E food', date: today, paymentMethod: 'credit-card' },
      { id: 'e2e-bill', type: 'expense', amount: 300, categoryId: 'groceries', note: 'E2E card bill', date: today, paymentMethod: 'credit-card-payment' },
      { id: 'e2e-save', type: 'expense', amount: 1000, categoryId: 'savings-goal', note: 'E2E saving', date: today },
    ]));
  });

  await page.goto('/transactions');
  await expect(page.getByText('E2E card bill')).toBeVisible();
  await expect(page.getByTestId('transactions-spending-total')).toHaveText('₹300');

  await page.goto('/');
  await page.getByTestId('fab-add').click();
  await page.getByTestId('fab-menu-expense').click();
  await page.getByTestId('amount-input').fill('55');
  await page.getByTestId('category-groceries').click();
  await page.getByTestId('note-input').fill('E2E double tap');
  await page.getByTestId('submit-transaction').evaluate(button => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')
      .filter((t: { note?: string }) => t.note === 'E2E double tap').length);
  expect(saved).toBe(1);
});

test('[BUD-002] copying budget limits lists every overwrite and changes limits only', async ({ page }) => {
  await prepare(page, ({ thisMonth, nextMonth }) => {
    localStorage.setItem('financial-clarity:budgets', JSON.stringify([
      { id: 'src-groceries', categoryId: 'groceries', limit: 5000, month: thisMonth },
      { id: 'src-rent', categoryId: 'rent', limit: 15000, month: thisMonth },
      { id: 'dst-groceries', categoryId: 'groceries', limit: 4000, month: nextMonth },
      { id: 'dst-health', categoryId: 'health', limit: 1000, month: nextMonth },
    ]));
  });

  await page.goto('/budgets');
  await page.getByTestId('transfer-budget-button').click();
  const dialog = page.getByTestId('budget-copy-dialog');
  await expect(dialog).toContainText('no money is moved');
  await expect(page.getByTestId('budget-copy-overwritten')).toContainText('Groceries ₹4,000 → ₹5,000');
  await expect(page.getByTestId('budget-copy-created')).toContainText('Rent ₹15,000');
  await expect(dialog).toContainText('1 other');
  await page.getByTestId('budget-copy-confirm').click();
  await expect(page.getByText(/Copied 2 budget limits/)).toBeVisible();

  const next = await page.evaluate(nextMonth =>
    JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]')
      .filter((b: { month: string }) => b.month === nextMonth)
      .map((b: { categoryId: string; limit: number }) => `${b.categoryId}:${b.limit}`)
      .sort(), monthKey(1));
  expect(next).toEqual(['groceries:5000', 'health:1000', 'rent:15000']);
  const transactions = await page.evaluate(() => localStorage.getItem('financial-clarity:transactions'));
  expect(JSON.parse(transactions ?? '[]')).toEqual([]);
});
