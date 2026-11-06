import { expect, test, type Page } from '@playwright/test';

async function blockGoogleAuthNetwork(page: Page) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    (route) => route.abort(),
  );
}

test('[APP-001] fresh browser context shows first-run onboarding', async ({ page }) => {
  await blockGoogleAuthNetwork(page);
  await page.goto('/');

  await expect(
    page.getByRole('dialog', { name: 'Welcome to Fiscal Focus' }),
  ).toBeVisible();
});

test('[NAV-001] navigate between primary pages and settings sections', async ({
  page,
}) => {
  await blockGoogleAuthNetwork(page);
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const [label, path] of [
    ['Transactions', '/transactions'],
    ['Budgets', '/budgets'],
    ['Analysis', '/analysis'],
    ['Settings', '/settings'],
  ] as const) {
    await page.locator('nav:visible').getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }

  for (const [testId, path, heading] of [
    ['settings-security-link', '/settings/security', 'Security'],
    ['settings-recurring-link', '/settings/recurring', 'Recurring Expenses'],
    ['settings-categories-link', '/settings/categories', 'Categories'],
    ['settings-backup-link', '/settings/backup', 'Backup & Restore'],
    ['settings-savings-link', '/settings/savings', 'Savings'],
  ] as const) {
    await page.getByTestId(testId).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.goto('/settings');
  }

  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('[TXN-001] reject invalid amounts and persist a valid expense', async ({
  page,
}) => {
  await blockGoogleAuthNetwork(page);
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/transactions');
  await expect(page.getByText(/No transactions yet for/)).toBeVisible();
  await page.goto('/');

  await page.getByTestId('fab-add').click();
  await page.getByTestId('fab-menu-expense').click();
  await expect(page.getByTestId('transaction-sheet')).toBeVisible();

  const amount = page.getByTestId('amount-input');
  const submit = page.getByTestId('submit-transaction');
  await expect(submit).toBeDisabled();
  await amount.fill('0');
  await page.getByTestId('category-groceries').click();
  await expect(submit).toBeDisabled();
  await amount.fill('-25');
  await expect(submit).toBeDisabled();
  await amount.fill('not-a-number');
  await expect(submit).toBeDisabled();

  await amount.fill('125.50');
  await expect(submit).toBeEnabled();
  await page.getByTestId('note-input').fill('E2E synthetic groceries');
  await submit.click();
  await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);

  await page.locator('nav:visible').getByRole('link', { name: 'Transactions' }).click();
  await expect(
    page.locator('[data-testid^="txn-"]').filter({ hasText: 'E2E synthetic groceries' }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.locator('[data-testid^="txn-"]').filter({ hasText: 'E2E synthetic groceries' }),
  ).toHaveCount(1);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('[SEC-001] keep financial content hidden until the correct PIN is entered', async ({
  page,
}) => {
  await blockGoogleAuthNetwork(page);
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });
  await page.goto('/settings/security');
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
  await expect(page.getByTestId('security-enable')).toBeVisible();
  await page.getByTestId('security-enable').click();

  const setupDialog = page.getByRole('dialog');
  await expect(setupDialog.getByText('Choose a 4-digit PIN')).toBeVisible();
  await setupDialog.getByRole('textbox').fill('1234');
  await expect(setupDialog.getByText('Confirm your PIN')).toBeVisible();
  await setupDialog.getByRole('textbox').fill('1234');
  await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();
  await expect(page.getByTestId('security-biometric-toggle')).toBeDisabled();
  await expect(
    page.getByText('Biometrics are only available in the Android app runtime, not browser preview.'),
  ).toBeVisible();

  await page.reload();
  const lockDialog = page.getByRole('dialog', { name: 'App locked' });
  await expect(lockDialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  await lockDialog.getByRole('textbox').fill('0000');
  await expect(lockDialog.getByText('Incorrect PIN. Try again.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  await lockDialog.getByRole('textbox').fill('1234');
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
