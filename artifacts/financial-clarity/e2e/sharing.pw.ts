import { expect, test } from '@playwright/test';

test('[SHR-001] a failed Overview image share is shown to the user', async ({ page }) => {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    // Make image rendering fail.
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('e2e: rendering blocked'); };
  });

  await page.goto('/analysis');
  await page.getByTestId('analysis-share').click();
  await expect(page.getByText('Couldn\u2019t share the image', { exact: true })).toBeVisible();
  await expect(page.getByText(/^The Overview image couldn.t be created or shared\. Your data is unchanged/)).toBeVisible();
});
