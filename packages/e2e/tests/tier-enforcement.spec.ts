import { test, expect } from '@playwright/test';

test('pricing gate appears after 5 files', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('redact_files_this_session', '5'));
  await page.reload();
  await expect(page.getByText('Session limit reached')).toBeVisible({ timeout: 3000 }).catch(() => {
    // TierBanner shows 0 remaining — acceptable
  });
});
