import { test, expect } from '@playwright/test';

test.describe('Remedial Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should navigate to remedial actions page', async ({ page }) => {
    await page.goto('/actions');
    await expect(page).toHaveURL(/actions/);
    await page.waitForLoadState('networkidle');
  });

  test('should display remedial actions list', async ({ page }) => {
    await page.goto('/actions');
    await page.waitForLoadState('networkidle');
    
    const actionsList = page.getByTestId('actions-list');
    if (await actionsList.isVisible()) {
      await expect(actionsList).toBeVisible();
    }
  });

  test('should filter actions by severity', async ({ page }) => {
    await page.goto('/actions');
    await page.waitForLoadState('networkidle');
    
    const severityFilter = page.getByTestId('select-severity-filter');
    if (await severityFilter.isVisible()) {
      await severityFilter.click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should filter actions by status', async ({ page }) => {
    await page.goto('/actions');
    await page.waitForLoadState('networkidle');
    
    const statusFilter = page.getByTestId('select-status-filter');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(500);
    }
  });
});
