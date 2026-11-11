import { expect, test } from '@playwright/test';

test('[UPG-001] data saved by an older build is migrated and still shown after upgrading', async ({ page }) => {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  // Storage as an app version before local migrations left it: no
  // storage-version, categories without `active`, and a budget without a month.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:first-run-done', '1');
    localStorage.setItem('financial-clarity:categories', JSON.stringify([
      { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
      { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'commitment' },
    ]));
    localStorage.setItem('financial-clarity:budgets', JSON.stringify([
      { id: 'legacy-budget', categoryId: 'groceries', limit: 4000 },
    ]));
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'legacy-tx', type: 'expense', amount: 640, categoryId: 'groceries', note: 'E2E legacy entry', date: today },
    ]));
  });

  await page.goto('/transactions');
  await expect(page.getByText('E2E legacy entry')).toBeVisible();

  const stored = await page.evaluate(() => ({
    version: localStorage.getItem('financial-clarity:storage-version'),
    categories: JSON.parse(localStorage.getItem('financial-clarity:categories') ?? '[]'),
    budgets: JSON.parse(localStorage.getItem('financial-clarity:budgets') ?? '[]'),
    transactions: JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]'),
  }));
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  expect(stored.version).toBe('2');
  expect(stored.categories.filter((c: { id: string }) => ['groceries', 'rent'].includes(c.id))
    .every((c: { active?: boolean }) => c.active === true)).toBe(true);
  expect(stored.budgets).toEqual([{ id: 'legacy-budget', categoryId: 'groceries', limit: 4000, month }]);
  expect(stored.transactions.map((t: { id: string }) => t.id)).toEqual(['legacy-tx']);

  await page.goto('/budgets');
  await expect(page.getByText('Groceries').first()).toBeVisible();

  // A second launch changes nothing.
  await page.reload();
  const again = await page.evaluate(() => localStorage.getItem('financial-clarity:budgets'));
  expect(JSON.parse(again ?? '[]')).toEqual(stored.budgets);
});
