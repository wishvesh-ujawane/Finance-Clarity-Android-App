import { expect, test, type Page } from '@playwright/test';

async function setupSecurityPage(page: Page) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
  });
  await page.goto('/settings/security');
  await expect(page.getByTestId('security-enable')).toBeVisible();
}

async function setStorageFailure(page: Page, operation: 'setItem' | 'removeItem') {
  await page.evaluate(operation => {
    sessionStorage.setItem(`e2e:fail:${operation}`, '1');
    if (operation === 'setItem') {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'financial-clarity:security' && sessionStorage.getItem('e2e:fail:setItem')) {
          throw new DOMException('Simulated storage failure', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    } else {
      const original = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (key === 'financial-clarity:security' && sessionStorage.getItem('e2e:fail:removeItem')) {
          throw new DOMException('Simulated storage failure', 'SecurityError');
        }
        return original.call(this, key);
      };
    }
  }, operation);
}

test('[SEC-002] failed PIN setup reports an error and allows retry', async ({ page }) => {
  await setupSecurityPage(page);
  await setStorageFailure(page, 'setItem');
  await page.getByTestId('security-enable').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('1234');
  await expect(dialog.getByText('Confirm your PIN')).toBeVisible();
  await dialog.getByRole('textbox').fill('1234');
  await expect(dialog.getByText(/Could not save security settings/)).toBeVisible();
  await expect(page.getByText('App lock enabled with PIN only.')).toHaveCount(0);
  await expect(dialog.getByRole('textbox')).toHaveValue('');
  await page.evaluate(() => sessionStorage.removeItem('e2e:fail:setItem'));
  await dialog.getByRole('textbox').fill('1234');
  await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();
  await page.reload();
  const lock = page.getByRole('dialog', { name: 'App locked' });
  await expect(lock).toBeVisible();
  await lock.getByRole('textbox').fill('1234');
  await expect(page.getByTestId('security-disable')).toBeVisible();
});

test('[SEC-003] failed PIN change and lock removal preserve the existing PIN', async ({ page }) => {
  await setupSecurityPage(page);
  await page.getByTestId('security-enable').click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('1234');
  await expect(dialog.getByText('Confirm your PIN')).toBeVisible();
  await dialog.getByRole('textbox').fill('1234');
  await expect(page.getByText('App lock enabled with PIN only.')).toBeVisible();

  await setStorageFailure(page, 'setItem');
  await page.getByTestId('security-change-pin').click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('1234');
  await expect(dialog.getByText('Choose a new PIN')).toBeVisible();
  await dialog.getByRole('textbox').fill('5678');
  await expect(dialog.getByText('Confirm new PIN')).toBeVisible();
  await dialog.getByRole('textbox').fill('5678');
  await expect(dialog.getByText(/Could not save security settings/)).toBeVisible();
  await expect(page.getByText('PIN updated.')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await setStorageFailure(page, 'removeItem');
  await page.getByTestId('security-disable').click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('1234');
  await expect(dialog.getByText(/Could not remove security settings/)).toBeVisible();
  await expect(page.getByText('App lock disabled.')).toHaveCount(0);
  await page.reload();
  const lock = page.getByRole('dialog', { name: 'App locked' });
  await expect(lock).toBeVisible();
  await lock.getByRole('textbox').fill('5678');
  await expect(lock.getByText('Incorrect PIN. Try again.')).toBeVisible();
  await lock.getByRole('textbox').fill('1234');
  await expect(page.getByTestId('security-disable')).toBeVisible();
});
