import { expect, test } from '@playwright/test';

test('[REC-003] recurring expenses are generated only after the app is unlocked', async ({ page }) => {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });

  await page.goto('/settings/security');
  await page.getByTestId('security-enable').click();
  const setupDialog = page.getByRole('dialog');
  await setupDialog.getByRole('textbox').fill('1234');
  await expect(setupDialog.getByText('Confirm your PIN')).toBeVisible();
  await setupDialog.getByRole('textbox').fill('1234');
  await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();

  // A rule that is due today.
  await page.evaluate(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('financial-clarity:recurring', JSON.stringify([{
      id: 'e2e-locked-rule', description: 'E2E locked rule', amount: 100,
      categoryId: 'rent', dayOfMonth: now.getDate(), active: true, startMonth: month,
    }]));
  });

  await page.reload();
  const lockDialog = page.getByRole('dialog', { name: 'App locked' });
  await expect(lockDialog).toBeVisible();
  const generatedWhileLocked = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')
      .filter((t: { recurringRuleId?: string }) => t.recurringRuleId === 'e2e-locked-rule').length);
  expect(generatedWhileLocked).toBe(0);

  await lockDialog.getByRole('textbox').fill('1234');
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')
      .filter((t: { recurringRuleId?: string }) => t.recurringRuleId === 'e2e-locked-rule').length === 1);

  // Returning to the foreground does not add it again.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const afterResume = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('financial-clarity:transactions') ?? '[]')
      .filter((t: { recurringRuleId?: string }) => t.recurringRuleId === 'e2e-locked-rule').length);
  expect(afterResume).toBe(1);
});
