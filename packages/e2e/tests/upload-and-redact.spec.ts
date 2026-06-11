import { test, expect } from '@playwright/test';
import path from 'path';

test('home page loads and shows upload zone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Redact sensitive data instantly')).toBeVisible();
  await expect(page.getByLabel('Upload file for redaction')).toBeVisible();
});

test('free tier banner shows when 3 files remain', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('redact_files_this_session', '3'));
  await page.reload();
  await expect(page.getByText(/free file/i)).toBeVisible();
});

test('pricing page renders all plans', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Free')).toBeVisible();
  await expect(page.getByText('Pro')).toBeVisible();
  await expect(page.getByText('Team')).toBeVisible();
});
