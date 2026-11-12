import { expect, test } from '@playwright/test';

test('[MER-001] month-end records a card bill payment without counting it as spending, and reconcile counts the unpaid rest', async ({ page }) => {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:first-run-done', '1');
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-salary', type: 'income', amount: 50000, categoryId: 'salary', note: 'E2E salary', date: `${month}-01` },
      { id: 'e2e-card-buy', type: 'expense', amount: 8000, categoryId: 'groceries', note: 'E2E card purchase', date: `${month}-10`, paymentMethod: 'credit-card' },
    ]));
    localStorage.setItem('e2e:review-month', month);
  });

  await page.goto('/');
  await expect(page.getByTestId('month-end-review-modal')).toBeVisible();
  await expect(page.getByText('Step 1 of 4 · Look back')).toBeVisible();
  await page.getByTestId('month-end-continue').click();

  await expect(page.getByText('Step 2 of 4 · Card bill')).toBeVisible();
  await expect(page.getByTestId('card-bill-owed')).toContainText('8,000');

  await page.getByTestId('card-bill-amount').fill('9000');
  await expect(page.getByRole('alert').filter({ hasText: 'more than the unpaid amount' })).toBeVisible();
  await expect(page.getByTestId('card-bill-record')).toBeDisabled();

  await page.getByTestId('card-bill-amount').fill('5000');
  await page.getByTestId('card-bill-record').click();
  await expect(page.getByTestId('card-bill-recorded')).toContainText('5,000');
  await expect(page.getByTestId('card-bill-owed')).toContainText('3,000');

  const stored = await page.evaluate(() => {
    const month = localStorage.getItem('e2e:review-month') ?? '';
    const transactions = JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]') as Array<Record<string, unknown>>;
    return { month, payments: transactions.filter(t => t.paymentMethod === 'credit-card-payment') };
  });
  expect(stored.payments).toHaveLength(1);
  expect(stored.payments[0]).toMatchObject({ type: 'expense', amount: 5000, categoryId: 'other' });
  expect(String(stored.payments[0].date).startsWith(stored.month)).toBe(true);

  await page.getByTestId('card-bill-continue').click();
  await expect(page.getByText('Step 3 of 4 · Reconcile')).toBeVisible();
  // 50,000 income - 8,000 card spending + 3,000 still unpaid from the bank.
  await expect(page.getByTestId('reconcile-expected')).toContainText('45,000');
  await expect(page.getByTestId('reconcile-card-note')).toContainText('3,000');

  await page.getByTestId('reconcile-back').click();
  await page.getByTestId('card-bill-back').click();
  await expect(page.getByText('Step 1 of 4 · Look back')).toBeVisible();
});

test('[MER-002] a failed budget save in month-end planning shows an error and keeps the value', async ({ page }) => {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:first-run-done', '1');
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-salary', type: 'income', amount: 40000, categoryId: 'salary', note: 'E2E salary', date: `${month}-01` },
      { id: 'e2e-cash', type: 'expense', amount: 1200, categoryId: 'groceries', note: 'E2E cash spend', date: `${month}-05`, paymentMethod: 'cash' },
    ]));
  });

  await page.goto('/');
  await expect(page.getByText('Step 1 of 3 · Look back')).toBeVisible();
  await page.getByTestId('month-end-continue').click();
  await page.getByTestId('reconcile-skip').click();
  await expect(page.getByText('Step 3 of 3 · Plan ahead')).toBeVisible();

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'financial-clarity:budgets' && sessionStorage.getItem('e2e:fail-budgets')) {
        throw new DOMException('Simulated full storage', 'QuotaExceededError');
      }
      return original.call(this, k, v);
    };
    sessionStorage.setItem('e2e:fail-budgets', '1');
  });

  const input = page.getByTestId('budget-step-input');
  await input.fill('2500');
  await page.getByTestId('budget-step-save-next').click();
  await expect(page.getByTestId('budget-step-save-error')).toContainText('phone storage is full');
  await expect(input).toHaveValue('2500');
  expect(await page.evaluate(() => localStorage.getItem('financial-clarity:budgets'))).toBeNull();

  await page.evaluate(() => sessionStorage.removeItem('e2e:fail-budgets'));
  await page.getByTestId('budget-step-save-next').click();
  await expect(page.getByTestId('budget-step-save-error')).toHaveCount(0);
  const budgets = await page.evaluate(() => JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]'));
  expect(budgets).toHaveLength(1);
  expect(budgets[0].limit).toBe(2500);
});

test('[MER-003] savings are excluded from the bank and only the confirmed difference changes lifetime balance', async ({ page }) => {
    await page.route(/^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//, route => route.abort());
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e:seeded')) return;
      sessionStorage.setItem('e2e:seeded', '1');
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      localStorage.setItem('financial-clarity:first-run-done', '1');
      localStorage.setItem('financial-clarity:transactions', JSON.stringify([
        { id: 'income', type: 'income', amount: 200000, categoryId: 'salary', note: '', date: `${month}-01` },
        { id: 'goal', type: 'expense', amount: 100000, categoryId: 'savings-goal', note: '', date: `${month}-02` },
        { id: 'emergency', type: 'expense', amount: 30000, categoryId: 'savings-emergency', note: '', date: `${month}-03` },
      ]));
    });
    await page.goto('/');
    await page.getByTestId('month-end-continue').click();
    await expect(page.getByTestId('reconcile-expected')).toContainText('70,000');
    await page.getByTestId('reconcile-actual-input').fill('70000');
    await page.getByTestId('reconcile-savings-input').fill('135000');
    await expect(page.getByTestId('reconcile-savings-difference')).toContainText('5,000');
    await page.getByTestId('reconcile-mark-done').click();
    await expect(page.getByTestId('reconcile-continue')).toBeVisible();
    const corrections = await page.evaluate(() => {
      const txns = JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]') as Array<Record<string, unknown>>;
      return txns.filter(tx => tx.savingsCorrection);
    });
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({ amount: 5000, savingsCorrection: 'increase' });
    await page.getByTestId('month-end-close').click();
    await page.goto('/transactions');
    await page.getByRole('button', { name: 'Last Month', exact: true }).click();
    await page.getByTestId(`delete-savings-correction-${String(corrections[0].id)}`).click();
    await expect(page.getByRole('alertdialog')).toContainText('reconciliation records and bank adjustments stay unchanged');
    await page.getByTestId('confirm-delete-savings-correction').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const remaining = await page.evaluate(() => {
      const txns = JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]') as Array<Record<string, unknown>>;
      return txns.filter(tx => tx.savingsCorrection);
    });
    expect(remaining).toHaveLength(0);
  });

  test('[MER-004] lower savings needs a reason and a failed save keeps both amounts', async ({ page }) => {
    await page.route(/^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//, route => route.abort());
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e:seeded')) return;
      sessionStorage.setItem('e2e:seeded', '1');
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      localStorage.setItem('financial-clarity:first-run-done', '1');
      localStorage.setItem('financial-clarity:transactions', JSON.stringify([
        { id: 'income', type: 'income', amount: 100000, categoryId: 'salary', note: '', date: `${month}-01` },
        { id: 'saving', type: 'expense', amount: 30000, categoryId: 'savings-goal', note: '', date: `${month}-02` },
      ]));
    });
    await page.goto('/');
    await page.getByTestId('month-end-continue').click();
    await page.getByTestId('reconcile-actual-input').fill('75000');
    await page.getByTestId('reconcile-savings-input').fill('25000');
    await expect(page.getByTestId('reconcile-mark-done')).toHaveCount(0);
    await page.getByLabel('Transferred back to the bank').check();
    await expect(page.getByTestId('reconcile-expected')).toContainText('75,000');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'financial-clarity:reconciliations' && sessionStorage.getItem('e2e:fail-reconcile')) {
          throw new DOMException('Simulated full storage', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
      sessionStorage.setItem('e2e:fail-reconcile', '1');
    });
    await page.getByTestId('reconcile-mark-done').click();
    await expect(page.getByTestId('reconcile-save-error')).toContainText('storage is full');
    await expect(page.getByTestId('reconcile-actual-input')).toHaveValue('75000');
    await expect(page.getByTestId('reconcile-savings-input')).toHaveValue('25000');
    await page.evaluate(() => sessionStorage.removeItem('e2e:fail-reconcile'));
    await page.getByTestId('reconcile-mark-done').click();
    await expect(page.getByTestId('reconcile-continue')).toBeVisible();
  });
