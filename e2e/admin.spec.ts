import { test, expect } from '@playwright/test';

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should navigate to admin users page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/admin\/users/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to admin configuration page', async ({ page }) => {
    await page.goto('/admin/configuration');
    await expect(page).toHaveURL(/admin\/configuration/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to admin setup page', async ({ page }) => {
    await page.goto('/admin/setup');
    await expect(page).toHaveURL(/admin\/setup/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to system health page', async ({ page }) => {
    await page.goto('/admin/system-health');
    await expect(page).toHaveURL(/admin\/system-health/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to audit log page', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await expect(page).toHaveURL(/admin\/audit-log/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to factory settings page', async ({ page }) => {
    await page.goto('/admin/factory-settings');
    await expect(page).toHaveURL(/admin\/factory-settings/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to imports page', async ({ page }) => {
    await page.goto('/admin/imports');
    await expect(page).toHaveURL(/admin\/imports/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to integrations page', async ({ page }) => {
    await page.goto('/admin/integrations');
    await expect(page).toHaveURL(/admin\/integrations/);
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to API integration page', async ({ page }) => {
    await page.goto('/admin/api-integration');
    await expect(page).toHaveURL(/admin\/api-integration/);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Admin Authorization', () => {
  test('should show auth guard for unauthenticated access to admin pages', async ({ page }) => {
    await page.goto('/admin/users');
    
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 10000 });
  });
});
