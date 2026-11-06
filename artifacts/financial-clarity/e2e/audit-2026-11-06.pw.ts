import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Reproductions for defects found in docs/audits/2026-11-06-e2e-browser-audit.md.
// Each test asserts the CORRECT behaviour and is marked test.fail() because the
// defect is still present. When a fix lands, Playwright reports the test as an
// unexpected pass: remove its test.fail() line in the same change.

type SeedTxn = { id: string; type: 'income' | 'expense'; amount: number; categoryId: string; note: string };

async function prepare(page: Page, seed: SeedTxn[] = []) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript((rows: SeedTxn[]) => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    if (rows.length > 0 && !localStorage.getItem('financial-clarity:transactions')) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      localStorage.setItem(
        'financial-clarity:transactions',
        JSON.stringify(rows.map(row => ({ ...row, date: today }))),
      );
    }
  }, seed);
}

async function readStoredArray(page: Page, key: string): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(k => JSON.parse(localStorage.getItem(`financial-clarity:${k}`) ?? '[]'), key);
}

async function exportCsv(page: Page, path: string): Promise<string> {
  await page.goto('/transactions');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-csv').click(),
  ]);
  await download.saveAs(path);
  return fs.readFileSync(path, 'utf8');
}

async function enablePin(page: Page, pin: string) {
  await page.goto('/settings/security');
  await page.getByTestId('security-enable').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(pin);
  await expect(dialog.getByText('Confirm your PIN')).toBeVisible();
  await dialog.getByRole('textbox').fill(pin);
  await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();
}

test.beforeEach(({}, testInfo) => {
  // These are logic defects, not layout defects; one viewport is enough.
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop project only');
});

test('[CSV-001] CSV export neutralises spreadsheet formula cells', async ({ page }, testInfo) => {
  test.fail(true, 'Known defect: escapeCsvCell does not neutralise =, +, -, @ (AGENTS.md §9)');
  await prepare(page, [
    { id: 'e2e-formula', type: 'expense', amount: 100, categoryId: 'groceries', note: '=HYPERLINK("http://example.invalid","x")' },
  ]);
  const csv = await exportCsv(page, testInfo.outputPath('export.csv'));
  expect(csv).not.toMatch(/(^|,)"[=+\-@]/m);
});

test('[CSV-002] re-importing an exported CSV does not duplicate savings', async ({ page }, testInfo) => {
  test.fail(true, 'Known defect: savings rows match no "name|expense" category and are re-created as spending');
  await prepare(page, [
    { id: 'e2e-salary', type: 'income', amount: 50000, categoryId: 'salary', note: 'e2e salary' },
    { id: 'e2e-sip', type: 'expense', amount: 5000, categoryId: 'savings-emergency', note: 'e2e sip' },
  ]);
  const path = testInfo.outputPath('roundtrip.csv');
  await exportCsv(page, path);

  await page.goto('/settings/backup');
  await page.getByTestId('settings-import-input').setInputFiles(path);
  const confirm = page.getByRole('dialog').getByRole('button', { name: /import|confirm/i });
  if (await confirm.count()) await confirm.first().click();
  await page.waitForTimeout(500);

  const categories = await readStoredArray(page, 'categories');
  expect(categories.filter(c => c.name === 'Emergency Fund')).toHaveLength(1);
  expect(await readStoredArray(page, 'transactions')).toHaveLength(2);
});

test('[CSV-003] CSV import shows a preview before changing data', async ({ page }, testInfo) => {
  test.fail(true, 'Known defect: CSV import applies immediately (AGENTS.md §9, imported files need preview + confirmation)');
  await prepare(page);
  const path = testInfo.outputPath('new.csv');
  fs.writeFileSync(path, 'Date,Category,Amount,Note,Type\n2026-01-15,Groceries,250,e2e row,expense\n');

  await page.goto('/settings/backup');
  await page.getByTestId('settings-import-input').setInputFiles(path);
  await page.waitForTimeout(1000);
  // Nothing may be written until the user confirms a preview.
  expect(await readStoredArray(page, 'transactions')).toHaveLength(0);
});

test('[CSV-004] CSV import rejects impossible calendar dates', async ({ page }, testInfo) => {
  test.fail(true, 'Known defect: CSV date check is format-only, so 2026-13-45 is accepted');
  await prepare(page);
  const path = testInfo.outputPath('bad-date.csv');
  fs.writeFileSync(path, 'Date,Category,Amount,Note,Type\n2026-13-45,Groceries,250,e2e bad date,expense\n');

  await page.goto('/settings/backup');
  await page.getByTestId('settings-import-input').setInputFiles(path);
  await expect(page.getByText(/invalid date/i)).toBeVisible();
  expect(await readStoredArray(page, 'transactions')).toHaveLength(0);
});

test('[SEC-004] financial content is not rendered while the app is locked', async ({ page }) => {
  test.fail(true, 'Known defect: routes stay mounted under the lock overlay ("Locked means not rendered", AGENTS.md §9)');
  await prepare(page, [
    { id: 'e2e-salary', type: 'income', amount: 50000, categoryId: 'salary', note: 'e2e salary' },
  ]);
  await enablePin(page, '1234');
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'App locked' })).toBeVisible();
  await expect(page.getByTestId('balance-amount')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(0);
});

test('[SEC-005] failed-PIN cooldown survives a reload', async ({ page }) => {
  test.fail(true, 'Known defect: attempt counter and cooldown live only in React state');
  await prepare(page);
  await enablePin(page, '1234');
  await page.reload();
  const lock = page.getByRole('dialog', { name: 'App locked' });
  for (const wrong of ['0000', '0001', '0002', '0003', '0004']) {
    await lock.getByRole('textbox').fill(wrong);
  }
  await expect(lock.getByText(/Too many attempts/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'App locked' }).getByRole('textbox')).toBeDisabled();
});

test('[SEC-006] keyboard focus cannot leave the lock screen', async ({ page }) => {
  test.fail(true, 'Known defect: lock overlay has no focus trap');
  await prepare(page);
  await enablePin(page, '1234');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'App locked' })).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const insideLock = await page.evaluate(
      () => Boolean(document.activeElement?.closest('[aria-label="App locked"], [role="alertdialog"]')),
    );
    expect(insideLock).toBe(true);
  }
});

test('[CAT-002] a category with transactions cannot be deleted', async ({ page }) => {
  test.fail(true, 'Known defect: Delete is offered for used categories (PRD FR-03, D6)');
  await prepare(page, [
    { id: 'e2e-groceries', type: 'expense', amount: 300, categoryId: 'groceries', note: 'e2e groceries' },
  ]);
  await page.goto('/settings/categories');
  await page.getByTestId('category-item-groceries').click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Groceries');
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Category' })).toHaveCount(0);
});
