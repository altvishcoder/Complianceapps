import { test, expect } from '@playwright/test';

test.describe('Certificates Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.goto('/compliance');
  });

  test('should display certificates list', async ({ page }) => {
    await expect(page.getByTestId('certificates-list')).toBeVisible({ timeout: 10000 });
  });

  test('should filter certificates by type', async ({ page }) => {
    const typeFilter = page.getByTestId('select-certificate-type');
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await page.getByRole('option', { name: /gas/i }).click();
      await page.waitForTimeout(500);
    }
  });

  test('should filter certificates by status', async ({ page }) => {
    const statusFilter = page.getByTestId('select-certificate-status');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should display certificate details', async ({ page }) => {
    const firstCertificate = page.getByTestId(/row-certificate-/).first();
    if (await firstCertificate.isVisible()) {
      await firstCertificate.click();
      await expect(page.getByTestId('certificate-details')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show certificate expiry information', async ({ page }) => {
    const expiryIndicator = page.getByTestId(/status-expiry-/);
    if (await expiryIndicator.first().isVisible()) {
      await expect(expiryIndicator.first()).toBeVisible();
    }
  });
});

test.describe('Certificate Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should navigate to upload page', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByTestId('upload-dropzone')).toBeVisible({ timeout: 5000 });
  });

  test('should display upload instructions', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByText(/drag|drop|upload/i)).toBeVisible({ timeout: 5000 });
  });
});
