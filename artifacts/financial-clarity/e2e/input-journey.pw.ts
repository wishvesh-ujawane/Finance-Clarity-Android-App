import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end journey where every record is created through the UI (no
 * seeded storage), then checked for consistency across screens (PRD §12:
 * the same number means the same thing everywhere). Also checks that every
 * link resolves and every visible button can actually be tapped.
 */

function monthKey(offset: number) {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
}

async function blockGoogle(page: Page) {
  await page.route(/^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//, r => r.abort());
}

async function nav(page: Page, name: string) {
  // Bottom nav on mobile, sidebar on desktop: the visible one is used.
  await page.getByRole('link', { name, exact: true }).locator('visible=true').first().click();
}

async function openFabItem(page: Page, testId: string) {
  await page.getByTestId('fab-add').click();
  await page.getByTestId(testId).click();
  await expect(page.getByTestId('transaction-sheet')).toBeVisible();
}

test.describe('input-driven journey', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
  });

  test('[JRN-001] data entered through the UI links up across every screen', async ({ page }) => {
    test.setTimeout(120_000);
    await blockGoogle(page);
    const pageErrors: Error[] = [];
    page.on('pageerror', e => pageErrors.push(e));

    // First run: onboarding through its own buttons.
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Welcome to Fiscal Focus' })).toBeVisible();
    await page.getByTestId('onboarding-skip').click();
    await page.getByTestId('onboarding-skip-auth').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // A new category, created from Settings → Categories.
    await nav(page, 'Settings');
    await page.getByRole('link', { name: /Categories/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    await page.getByTestId('fab-add-category').click();
    await page.getByTestId('new-category-name').fill('Coffee');
    await page.getByTestId('new-category-type-expense').click();
    await page.getByTestId('new-category-create').click();
    await expect(page.getByText('Coffee', { exact: true })).toBeVisible();

    // Income and an expense entered with the calculator.
    await nav(page, 'Dashboard');
    await openFabItem(page, 'fab-menu-income');
    await page.getByTestId('amount-input').fill('50000');
    await page.getByTestId('category-salary').click();
    await page.getByTestId('submit-transaction').click();
    await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);

    await openFabItem(page, 'fab-menu-expense');
    const sheet = page.getByTestId('transaction-sheet');
    await page.getByTestId('amount-input').fill('250+50');
    await page.getByTestId('calculator-equals').click();
    await expect(page.getByTestId('amount-input')).toHaveValue(/300/);
    await sheet.getByRole('button', { name: /Coffee/ }).click();
    await page.getByTestId('note-input').fill('Latte with friends');
    await page.getByTestId('submit-transaction').click();
    await expect(sheet).toHaveCount(0);

    await expect(page.getByTestId('income-amount')).toContainText('₹50,000');
    await expect(page.getByTestId('expenses-amount')).toContainText('₹300');
    await expect(page.getByText('Latte with friends')).toBeVisible();

    // A budget for the new category.
    await nav(page, 'Budgets');
    await page.getByTestId('fab-add').click();
    await page.getByTestId('fab-menu-budget').click();
    await page.getByTestId('budget-category-select').selectOption({ label: 'Coffee' });
    await page.getByTestId('budget-limit-input').fill('1000');
    await page.getByTestId('budget-save').click();
    const coffeeBudget = page.locator('[data-testid^="budget-"]').filter({ hasText: 'Coffee' }).first();
    await expect(coffeeBudget).toContainText('₹300');
    await expect(coffeeBudget).toContainText('₹1,000');

    // A recurring payment that starts next month.
    await nav(page, 'Settings');
    await page.getByRole('link', { name: /Recurring/ }).first().click();
    await page.getByTestId('fab-add-recurring').click();
    await page.getByTestId('recurring-description').fill('Gym membership');
    await page.getByTestId('recurring-amount').fill('1200');
    await page.getByTestId('recurring-category').selectOption({ label: 'Coffee' });
    await page.getByTestId('recurring-day').fill('28');
    await page.getByTestId('recurring-start').fill(monthKey(1));
    await page.getByTestId('recurring-save').click();
    await expect(page.getByText('Gym membership')).toBeVisible();

    // Analysis reflects the same records.
    await nav(page, 'Analysis');
    await expect(page.getByTestId('top-categories-pie')).toContainText('Coffee');
    await expect(page.getByTestId('top-categories-pie')).toContainText('₹300');
    await expect(page.getByTestId('budget-vs-spent-card')).toContainText('Coffee');
    await page.getByRole('tab', { name: 'Planning' }).click();
    await expect(page.getByTestId('upcoming-obligations')).toContainText('Gym membership');
    await expect(page.getByTestId('upcoming-obligations')).toContainText('₹1,200');

    // Editing the expense updates every screen that shows it.
    await nav(page, 'Transactions');
    await page.getByTestId('transactions-search').fill('Latte');
    await page.getByText('Latte with friends').click();
    await expect(page.getByTestId('transaction-sheet')).toBeVisible();
    await page.getByTestId('amount-input').fill('400');
    await page.getByTestId('submit-transaction').click();
    await expect(page.getByTestId('transaction-sheet')).toHaveCount(0);
    await expect(page.getByTestId('transactions-spending-total')).toHaveText('₹400');

    await nav(page, 'Dashboard');
    await expect(page.getByTestId('expenses-amount')).toContainText('₹400');
    await nav(page, 'Budgets');
    await expect(page.locator('[data-testid^="budget-"]').filter({ hasText: 'Coffee' }).first()).toContainText('₹400');

    // A category in use cannot be deleted (PRD FR-03).
    await nav(page, 'Settings');
    await page.getByRole('link', { name: /Categories/ }).first().click();
    await page.getByText('Coffee', { exact: true }).click();
    await expect(page.getByTestId('category-delete-blocked')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('[JRN-002] every link resolves and every visible button can be tapped', async ({ page }) => {
    test.setTimeout(120_000);
    await blockGoogle(page);
    await page.addInitScript(({ cur, prev }) => {
      if (sessionStorage.getItem('e2e:seeded')) return;
      sessionStorage.setItem('e2e:seeded', '1');
      localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
      localStorage.setItem(`financial-clarity:month-end-review:${prev}`, `dismissed:${Date.now()}`);
      localStorage.setItem('financial-clarity:transactions', JSON.stringify([
        { id: 'l-sal', type: 'income', amount: 40000, categoryId: 'salary', note: '', date: `${cur}-01` },
        { id: 'l-gro', type: 'expense', amount: 900, categoryId: 'groceries', note: 'Veg', date: `${cur}-01` },
      ]));
      localStorage.setItem('financial-clarity:budgets', JSON.stringify([{ id: 'l-b', categoryId: 'groceries', limit: 2000, month: cur }]));
      localStorage.setItem('financial-clarity:recurring', JSON.stringify([
        { id: 'l-r', description: 'Rent', amount: 9000, categoryId: 'rent', dayOfMonth: 28, active: true, startMonth: cur, lastGeneratedMonth: cur },
      ]));
    }, { cur: monthKey(0), prev: monthKey(-1) });

    const routes = ['/', '/transactions', '/budgets', '/analysis', '/settings', '/settings/recurring',
      '/settings/categories', '/settings/savings', '/settings/profile', '/settings/security', '/settings/backup', '/settings/changelog'];
    const hrefs = new Set<string>();
    const blocked: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      for (const h of await page.locator('a[href^="/"]').evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''))) hrefs.add(h);
      // Scroll through the page and check each visible enabled button is the
      // top element at its centre (nothing — FAB, nav, overlay — covers it).
      const covered = await page.evaluate(async () => {
        const out: string[] = [];
        const scroller = document.scrollingElement ?? document.documentElement;
        const seen = new Set<Element>();
        for (let y = 0; y <= scroller.scrollHeight; y += Math.max(200, window.innerHeight - 200)) {
          window.scrollTo(0, y);
          await new Promise(r => requestAnimationFrame(() => r(null)));
          const nav = document.querySelector('nav.fixed, nav[class*="fixed"]');
          const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
          for (const b of Array.from(document.querySelectorAll<HTMLElement>('main button:not([disabled]), main a[href]'))) {
            if (seen.has(b)) continue;
            const r = b.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (r.width === 0 || r.height === 0 || cy < 0 || cy > navTop - 1 || cx < 0 || cx > window.innerWidth) continue;
            if (b.closest('[aria-hidden="true"]')) continue;
            seen.add(b);
            const top = document.elementFromPoint(cx, cy);
            if (top && !b.contains(top) && !top.contains(b)) {
              out.push(`${(b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 30)} covered by ${top.getAttribute('aria-label') ?? top.tagName}`);
            }
          }
        }
        return out;
      });
      blocked.push(...covered.map(c => `${route}: ${c}`));
    }
    expect.soft(blocked, 'buttons covered by another element').toEqual([]);

    for (const href of hrefs) {
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      await expect.soft(page.getByText(/page not found|404/i), `${href} resolves to a screen`).toHaveCount(0);
    }
    expect(hrefs.size).toBeGreaterThan(5);
  });
});
