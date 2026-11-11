import { expect, test } from '@playwright/test';

test('[DSN-001] bundled fonts, Fiscal Focus branding, worded status chips, 11 px minimum text, reduced motion', async ({ page, isMobile }) => {
  const fontRequests: string[] = [];
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url());
  });
  await page.route(/^https:\/\/(apis\.google\.com|accounts\.google\.com)\//, route => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    localStorage.setItem('financial-clarity:budgets', JSON.stringify([{ id: 'b1', categoryId: 'groceries', limit: 100, month }]));
    localStorage.setItem('financial-clarity:transactions', JSON.stringify([
      { id: 't1', type: 'expense', amount: 250, categoryId: 'groceries', note: 'E2E over budget', date: `${month}-01` },
    ]));
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  if (!isMobile) await expect(page.locator('aside')).toContainText('Fiscal Focus');

  const chip = page.getByTestId('budget-alert-groceries');
  await expect(chip).toContainText('over by');
  expect(await chip.textContent()).not.toMatch(/[\u{1F534}\u{1F7E1}\u{1F7E2}\u{1F535}]/u);

  for (const path of ['/', '/transactions', '/budgets', '/analysis', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const tooSmall = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const ownText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        if (!ownText || el.closest('svg') || el.offsetParent === null) continue;
        if (el.getAttribute('aria-live') || el.closest('[aria-live]')) continue;
        // Recharts measures label widths in an off-screen span.
        if (el.id === 'recharts_measurement_span') continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 11) offenders.push(`${el.tagName.toLowerCase()} ${size}px "${el.textContent?.trim().slice(0, 30)}"`);
      }
      return offenders;
    });
    expect(tooSmall, `text below 11 px on ${path}`).toEqual([]);
  }

  const transition = await page.evaluate(() => getComputedStyle(document.querySelector('main') as HTMLElement).transitionDuration);
  expect(parseFloat(transition)).toBeLessThan(0.001);

  expect(fontRequests).toEqual([]);
});
