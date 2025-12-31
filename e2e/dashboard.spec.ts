import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should display dashboard with key metrics', async ({ page }) => {
    await expect(page.getByTestId('dashboard-stats')).toBeVisible();
    await expect(page.getByTestId('stat-total-properties')).toBeVisible();
    await expect(page.getByTestId('stat-total-certificates')).toBeVisible();
    await expect(page.getByTestId('stat-compliance-rate')).toBeVisible();
  });

  test('should display compliance charts', async ({ page }) => {
    await expect(page.getByTestId('chart-compliance-status')).toBeVisible();
  });

  test('should navigate to properties page', async ({ page }) => {
    await page.getByTestId('nav-properties').click();
    await expect(page).toHaveURL(/properties/);
  });

  test('should navigate to certificates page', async ({ page }) => {
    await page.getByTestId('nav-certificates').click();
    await expect(page).toHaveURL(/compliance/);
  });
});

test.describe('Dashboard Responsiveness', () => {
  test('should display mobile navigation on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    const mobileNav = page.getByTestId('mobile-nav-toggle');
    if (await mobileNav.isVisible()) {
      await mobileNav.click();
      await expect(page.getByTestId('mobile-nav-menu')).toBeVisible();
    }
  });
});
