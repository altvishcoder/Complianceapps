import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('login page visual snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-form')).toBeVisible();
    
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('dashboard visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('properties page visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('properties-page.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('mobile login visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByTestId('login-form')).toBeVisible();
    
    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('mobile dashboard visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });
});

test.describe('Component Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('sidebar navigation visual snapshot', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot('sidebar.png', {
        maxDiffPixels: 50,
      });
    }
  });

  test('header visual snapshot', async ({ page }) => {
    const header = page.getByTestId('header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header.png', {
        maxDiffPixels: 50,
      });
    }
  });
});
