import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    localStorage.setItem('financial-clarity:categories', JSON.stringify([
      { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense', active: true },
      { id: 'leisure', name: 'Leisure', icon: 'Smile', color: '#F59E0B', type: 'expense', active: false },
    ]));
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 'e2e-leisure', type: 'expense', amount: 450, categoryId: 'leisure', note: 'E2E old leisure entry', date: today },
    ]));
  });
}

async function openExpenseSheet(page: Page) {
  await page.goto('/');
  await page.getByTestId('fab-add').click();
  await page.getByTestId('fab-menu-expense').click();
}

test('[CAT-003] an inactive category stays on history but is not offered for new entries', async ({ page }) => {
  await prepare(page);

  await page.goto('/transactions');
  await expect(page.getByText('E2E old leisure entry')).toBeVisible();
  await expect(page.getByText('Inactive', { exact: true })).toBeVisible();

  await openExpenseSheet(page);
  await expect(page.getByTestId('category-groceries')).toBeVisible();
  await expect(page.getByTestId('category-leisure')).toHaveCount(0);

  await page.goto('/settings/categories');
  await expect(page.getByTestId('category-inactive-leisure')).toBeVisible();
  await page.getByTestId('category-item-leisure').click();
  await page.getByTestId('category-toggle-active-leisure').click();
  await expect(page.getByTestId('category-toggle-active-leisure')).toHaveText('Mark inactive');

  await openExpenseSheet(page);
  await expect(page.getByTestId('category-leisure')).toBeVisible();
});
