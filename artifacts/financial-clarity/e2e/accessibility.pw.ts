import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * Accessibility checks (DESIGN §12): axe WCAG 2.1 AA scans of the main
 * screens and overlays, keyboard-only use, and reduced motion.
 * Synthetic data only.
 */

function monthKey(offset: number) {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
}

function seed() {
  const prev = monthKey(-1);
  const cur = monthKey(0);
  return {
    'financial-clarity:transactions': [
      { id: 'a11y-sal-p', type: 'income', amount: 60000, categoryId: 'salary', note: '', date: `${prev}-01` },
      { id: 'a11y-gro-p', type: 'expense', amount: 4200, categoryId: 'groceries', note: 'Market', date: `${prev}-03` },
      { id: 'a11y-sal', type: 'income', amount: 60000, categoryId: 'salary', note: '', date: `${cur}-01` },
      { id: 'a11y-gro', type: 'expense', amount: 3100, categoryId: 'groceries', note: 'Market', date: `${cur}-01`, paymentMethod: 'credit-card' },
    ],
    'financial-clarity:budgets': [{ id: 'a11y-b1', categoryId: 'groceries', limit: 5000, month: cur }],
  };
}

async function prepare(page: Page, opts: { onboarded?: boolean; dismissMonthEnd?: boolean; empty?: boolean } = {}) {
  await page.route(/^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//, r => r.abort());
  await page.addInitScript(({ data, onboarded, prev, dismiss }) => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    if (onboarded) localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    if (dismiss) localStorage.setItem(`financial-clarity:month-end-review:${prev}`, `dismissed:${Date.now()}`);
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, { data: opts.empty ? {} : seed(), onboarded: opts.onboarded ?? true, prev: monthKey(-1), dismiss: opts.dismissMonthEnd ?? true });
}

async function scan(page: Page, info: TestInfo, name: string, include?: string) {
  await page.waitForTimeout(500);
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const summary = results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ')),
    count: v.nodes.length,
  }));
  await info.attach(`axe ${name}`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
  expect.soft(summary, `${name}: axe WCAG 2.1 AA violations`).toEqual([]);
}

test.describe('accessibility', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
  });

  test('[A11Y-001] onboarding has no axe violations', async ({ page }, info) => {
    await prepare(page, { onboarded: false, empty: true });
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Welcome to Fiscal Focus' })).toBeVisible();
    await scan(page, info, 'onboarding');
  });

  test('[A11Y-002] dashboard has no axe violations', async ({ page }, info) => {
    await prepare(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await scan(page, info, 'dashboard');
  });

  test('[A11Y-003] transaction sheet is a labelled dialog with no axe violations', async ({ page }, info) => {
    await prepare(page);
    await page.goto('/transactions');
    await page.getByTestId('txn-a11y-gro').click();
    const sheet = page.getByRole('dialog', { name: 'Edit Transaction' });
    await expect(sheet).toBeVisible();
    await scan(page, info, 'transaction sheet', '[data-testid="transaction-sheet"]');
  });

  test('[A11Y-004] month-end review has no axe violations', async ({ page }, info) => {
    await prepare(page, { dismissMonthEnd: false });
    await page.goto('/');
    await expect(page.getByTestId('month-end-review-modal')).toBeVisible();
    await scan(page, info, 'month-end review');
  });

  test('[A11Y-008] card details and purchase editing preserve accessible dialogs and keyboard focus', async ({ page }, info) => {
    await prepare(page);
    await page.goto('/');
    const chip = page.getByTestId('card-debt-chip');
    await chip.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'On your card', exact: true });
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await scan(page, info, 'card details', '[data-testid="card-dues-sheet"]');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(chip).toBeFocused();

    await page.keyboard.press('Enter');
    await sheet.getByTestId('card-entry-a11y-gro').click();
    const edit = page.getByRole('dialog', { name: 'Edit Transaction' });
    await expect(edit).toBeVisible();
    await expect(edit.getByTestId('paid-with-card-checkbox')).toBeChecked();
    await expect.poll(() => edit.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await scan(page, info, 'card purchase edit', '[data-testid="transaction-sheet"]');
    await page.keyboard.press('Escape');
    await expect(edit).toBeHidden();
  });

  test('[A11Y-005] lock screen has no axe violations', async ({ page }, info) => {
    await prepare(page);
    await page.goto('/settings/security');
    await page.getByTestId('security-enable').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('1234');
    await expect(dialog.getByText('Confirm your PIN')).toBeVisible();
    await dialog.getByRole('textbox').fill('1234');
    await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'App locked' })).toBeVisible();
    await scan(page, info, 'lock screen');
  });

  test('[A11Y-006] keyboard only: every focused control shows a focus ring and the main flows work', async ({ page }) => {
    await prepare(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const missingRing: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
        return { label: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 30), ring };
      });
      if (info && !info.ring) missingRing.push(info.label);
    }
    expect.soft([...new Set(missingRing)], 'controls without a visible focus indicator').toEqual([]);

    // Open the entry sheet from the FAB with the keyboard, then close it with Escape.
    await page.getByTestId('fab-add').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Add expense', exact: true }).focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'Add Transaction' });
    await expect(sheet).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-testid="transaction-sheet"]')),
      'focus moves into the sheet').toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // Bottom navigation works with Enter.
    await page.getByRole('link', { name: 'Transactions' }).last().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test('[A11Y-007] reduced motion: sheets appear without a slide animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepare(page);
    await page.goto('/transactions');
    await page.getByTestId('txn-a11y-gro').click();
    const sheet = page.getByTestId('transaction-sheet');
    await expect(sheet).toBeVisible();
    // With reduced motion the sheet is in its final place on the next frame.
    const offset = await sheet.evaluate(el => new Promise<number>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const t = getComputedStyle(el).transform;
        resolve(t === 'none' ? 0 : Math.abs(new DOMMatrix(t).m42));
      }));
    }));
    expect(offset).toBeLessThanOrEqual(1);
    const durations = await page.evaluate(() => {
      const long: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        const ms = (v: string) => Math.max(...v.split(',').map(x => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000)));
        if (ms(s.transitionDuration) > 10 || (s.animationName !== 'none' && ms(s.animationDuration) > 10)) long.push(el.tagName + '.' + el.className.toString().slice(0, 40));
      }
      return long.slice(0, 10);
    });
    expect.soft(durations, 'CSS transitions/animations still running with reduced motion').toEqual([]);
  });
});
