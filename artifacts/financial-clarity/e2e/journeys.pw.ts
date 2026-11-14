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

test('[CARD-001] a card expense shows on the card chip, and a bill payment from the chip lowers it', async ({ page }) => {
  await prepare(page, () => undefined);

  await page.goto('/');
  await page.getByTestId('fab-add').click();
  await page.getByTestId('fab-menu-expense').click();
  await page.getByTestId('amount-input').fill('1200');
  await page.getByTestId('category-groceries').click();
  await page.getByTestId('paid-with-card-checkbox').check();
  await page.getByTestId('submit-transaction').click();
  await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);

  const chip = page.getByTestId('card-debt-chip');
  await expect(chip).toContainText('₹1,200 on your card');
  await chip.click();
  const sheet = page.getByTestId('card-dues-sheet');
  await expect(sheet.getByTestId('card-dues-owed')).toHaveText('₹1,200');
  await sheet.getByTestId('card-dues-full').click();
  await sheet.getByTestId('card-dues-record').click();
  await expect(sheet.getByTestId('card-dues-recorded')).toContainText('₹1,200 card bill payment');
  await expect(sheet.getByTestId('card-dues-owed')).toHaveText('₹0');
  await page.keyboard.press('Escape');
  await expect(chip).toContainText('₹0 on your card');

  await page.goto('/transactions');
  await expect(page.getByText('Card payment')).toBeVisible();
  await expect(page.getByTestId('transactions-spending-total')).toHaveText('₹1,200');
});

test('[BUD-003] Budgets and Analysis show the same budget summary', async ({ page }) => {
  await prepare(page, ({ thisMonth }) => {
    localStorage.setItem('financial-clarity:budgets', JSON.stringify([
      { id: 'b-groceries', categoryId: 'groceries', limit: 5000, month: thisMonth },
    ]));
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-groceries', type: 'expense', amount: 6000, categoryId: 'groceries', note: '', date: `${thisMonth}-01` },
      { id: 'e2e-dining', type: 'expense', amount: 800, categoryId: 'dining', note: '', date: `${thisMonth}-01` },
    ]));
  });

  await page.goto('/budgets');
  await expect(page.getByTestId('budget-summary-dayToDay-status')).toHaveText('₹1,000 over');
  await expect(page.getByTestId('budget-summary-dayToDay-unbudgeted')).toContainText('₹800');
  await expect(page.getByTestId('budget-summary-total')).toHaveText('₹6,800');

  await page.goto('/analysis');
  const health = page.getByTestId('monthly-budget-health');
  await expect(health.getByTestId('budget-summary-dayToDay-status')).toHaveText('₹1,000 over');
  await expect(health.getByTestId('budget-summary-dayToDay-unbudgeted')).toContainText('₹800');
  await expect(health.getByTestId('budget-summary-total')).toHaveText('₹6,800');
});

test('[TRD-001] Trends shows category changes and top categories instead of the removed charts', async ({ page }) => {
  await prepare(page, ({ thisMonth }) => {
    const [y, m] = thisMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-prev', type: 'expense', amount: 1000, categoryId: 'groceries', note: '', date: `${lastMonth}-01` },
      { id: 'e2e-now', type: 'expense', amount: 1500, categoryId: 'groceries', note: '', date: `${thisMonth}-01` },
    ]));
    localStorage.setItem(`financial-clarity:month-end-review:${lastMonth}`, `dismissed:${Date.now()}`);
  });

  await page.goto('/analysis');
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByTestId('category-changes')).toBeVisible();
  await expect(page.getByTestId('category-changes-up')).toContainText('Groceries');
  await expect(page.getByTestId('top-category-trend-list')).toContainText('Groceries');
  await expect(page.getByText('Monthly savings rate')).toHaveCount(0);
  await expect(page.getByText('When do you spend most?')).toHaveCount(0);
  await expect(page.getByText('Budget usage this month')).toHaveCount(0);
});
