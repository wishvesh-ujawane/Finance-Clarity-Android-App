import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });
}

/** Makes writes to `key` throw a quota error while the session flag is set. */
async function failWritesTo(page: Page, key: string) {
  await page.evaluate(storageKey => {
    sessionStorage.setItem('e2e:fail-key', storageKey);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === sessionStorage.getItem('e2e:fail-key')) {
        throw new DOMException('Simulated full storage', 'QuotaExceededError');
      }
      return original.call(this, k, v);
    };
  }, key);
}

test('[STO-001] a failed save keeps the entry form and stores nothing', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await failWritesTo(page, 'financial-clarity:transactions');

  await page.getByTestId('fab-add').click();
  await page.getByTestId('fab-menu-expense').click();
  await page.getByTestId('amount-input').fill('125');
  await page.getByTestId('category-groceries').click();
  await page.getByTestId('note-input').fill('E2E storage failure');
  await page.getByTestId('submit-transaction').click();

  await expect(page.getByTestId('transaction-save-error')).toContainText('phone storage is full');
  await expect(page.getByTestId('transaction-sheet')).toBeVisible();
  await expect(page.getByTestId('amount-input')).toHaveValue('125');
  await expect(page.getByTestId('note-input')).toHaveValue('E2E storage failure');

  await page.evaluate(() => sessionStorage.removeItem('e2e:fail-key'));
  await page.getByTestId('submit-transaction').click();
  await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);

  await page.reload();
  await page.goto('/transactions');
  await expect(
    page.locator('[data-testid^="txn-"]').filter({ hasText: 'E2E storage failure' }),
  ).toHaveCount(1);
});

test('[STO-002] a failed budget save keeps the sheet and entered values', async ({ page }) => {
  await prepare(page);
  await page.goto('/budgets');
  await page.getByTestId('empty-add-budget').click();
  await failWritesTo(page, 'financial-clarity:budgets');

  await page.getByTestId('budget-category-select').selectOption('groceries');
  await page.getByTestId('budget-limit-input').fill('5000');
  await page.getByTestId('budget-save').click();

  await expect(page.getByTestId('budget-save-error')).toContainText('phone storage is full');
  await expect(page.getByTestId('budget-category-select')).toHaveValue('groceries');
  await expect(page.getByTestId('budget-limit-input')).toHaveValue('5000');
  expect(await page.evaluate(() => localStorage.getItem('financial-clarity:budgets'))).toBeNull();
});

test('[STO-003] a failed recurring-rule save keeps the form and entered values', async ({ page }) => {
  await prepare(page);
  await page.goto('/settings/recurring');
  await page.getByTestId('empty-add-recurring').click();
  await failWritesTo(page, 'financial-clarity:recurring');

  await page.getByTestId('recurring-description').fill('E2E synthetic rent');
  await page.getByTestId('recurring-amount').fill('1200');
  await page.getByTestId('recurring-save').click();

  await expect(page.getByTestId('recurring-save-error')).toContainText('phone storage is full');
  await expect(page.getByTestId('recurring-description')).toHaveValue('E2E synthetic rent');
  await expect(page.getByTestId('recurring-amount')).toHaveValue('1200');
  expect(await page.evaluate(() => localStorage.getItem('financial-clarity:recurring'))).toBeNull();
});

test('[STO-004] a failed savings-target save is not reported as success', async ({ page }) => {
  await prepare(page);
  await page.goto('/settings/savings');
  await failWritesTo(page, 'financial-clarity:savings-goal');

  await page.getByTestId('goal-monthly').fill('500');
  await page.getByTestId('goal-save').click();

  await expect(page.getByTestId('savings-save-error')).toContainText('phone storage is full');
  await expect(page.getByText('Savings goals saved.')).toHaveCount(0);
  await expect(page.getByTestId('goal-monthly')).toHaveValue('500');
  expect(await page.evaluate(() => localStorage.getItem('financial-clarity:savings-goal'))).toBeNull();
});

test('[REC-002] resuming a paused rule skips past months and stays idempotent', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:recurring', JSON.stringify([{
      id: 'e2e-paused-rule', description: 'E2E paused-period test', amount: 100,
      categoryId: 'rent', dayOfMonth: now.getDate(), active: false, startMonth,
    }]));
    localStorage.setItem(`financial-clarity:month-end-review:${previousMonth}`, `dismissed:${Date.now()}`);
    localStorage.setItem('e2e:current-month', currentMonth);
  });
  await page.goto('/settings/recurring');

  await page.getByTestId('recurring-toggle-e2e-paused-rule').click();
  await page.waitForFunction(() => {
    const transactions = JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]');
    return transactions.some((transaction: { recurringRuleId?: string }) => transaction.recurringRuleId === 'e2e-paused-rule');
  });

  const firstRun = await page.evaluate(() => {
    const currentMonth = localStorage.getItem('e2e:current-month');
    const transactions = JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]');
    const occurrences = transactions.filter((transaction: { recurringRuleId?: string }) => transaction.recurringRuleId === 'e2e-paused-rule');
    return { currentMonth, occurrences };
  });
  expect(firstRun.occurrences).toHaveLength(1);
  expect(firstRun.occurrences[0].recurringMonth).toBe(firstRun.currentMonth);

  await page.reload();
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')
    .filter((transaction: { recurringRuleId?: string }) => transaction.recurringRuleId === 'e2e-paused-rule').length);
  expect(afterReload).toBe(1);
});

const QUARANTINE_PREFIX = 'financial-clarity:backup:transactions:';

async function seedOneBrokenTransaction(page: Page) {
  await page.addInitScript(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-readable', type: 'expense', amount: 75, categoryId: 'groceries', note: 'E2E readable entry', date: today },
      { id: 'e2e-broken', amount: 'not-a-number' },
    ]));
  });
}

async function quarantineCopies(page: Page, prefix: string) {
  return page.evaluate(p => Object.keys(localStorage).filter(key => key.startsWith(p)).length, prefix);
}

test('[STO-005] unreadable records are kept aside and reported without blocking the app', async ({ page }) => {
  await prepare(page);
  await seedOneBrokenTransaction(page);
  await page.goto('/transactions');

  await expect(page.getByTestId('storage-notice-banner')).toContainText('1 saved record couldn\u2019t be read');
  await expect(page.getByText('E2E readable entry')).toBeVisible();
  expect(await quarantineCopies(page, QUARANTINE_PREFIX)).toBe(1);

  await page.reload();
  await expect(page.getByTestId('storage-notice-banner')).toBeVisible();
  expect(await quarantineCopies(page, QUARANTINE_PREFIX)).toBe(1);

  await page.getByTestId('storage-notice-banner').getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('storage-notice-banner')).toHaveCount(0);
});

test('[STO-006] data from a newer app version is not opened or changed', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:storage-version', '99');
    localStorage.setItem('financial-clarity:transactions', '[{"id":"future-shape"}]');
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Update Fiscal Focus' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('financial-clarity:transactions'))).toBe('[{"id":"future-shape"}]');
  expect(await quarantineCopies(page, QUARANTINE_PREFIX)).toBe(0);
});

test('[STO-007] when a safe copy cannot be saved, continuing needs confirmation', async ({ page }) => {
  await prepare(page);
  await seedOneBrokenTransaction(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith('financial-clarity:backup:')) throw new DOMException('Simulated full storage', 'QuotaExceededError');
      return original.call(this, k, v);
    };
  });
  await page.goto('/');

  await expect(page.getByTestId('startup-error-screen')).toContainText('Nothing was changed');
  await page.getByTestId('startup-continue').click();
  await expect(page.getByTestId('startup-continue-dialog')).toContainText('permanently replaced');
  await page.getByTestId('startup-continue-confirm').click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]').length)).toBe(2);
});