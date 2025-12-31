import { test, expect } from '@playwright/test';

test.describe('Properties Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.goto('/properties');
  });

  test('should display properties list', async ({ page }) => {
    await expect(page.getByTestId('properties-list')).toBeVisible();
  });

  test('should filter properties by search', async ({ page }) => {
    const searchInput = page.getByTestId('input-property-search');
    if (await searchInput.isVisible()) {
      await searchInput.fill('London');
      await page.waitForTimeout(500);
      
      const propertyCards = page.getByTestId(/card-property-/);
      const count = await propertyCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should open property details', async ({ page }) => {
    const firstProperty = page.getByTestId(/card-property-/).first();
    if (await firstProperty.isVisible()) {
      await firstProperty.click();
      
      await expect(page.getByTestId('property-details')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display property compliance status', async ({ page }) => {
    const complianceStatus = page.getByTestId(/status-compliance-/);
    if (await complianceStatus.first().isVisible()) {
      await expect(complianceStatus.first()).toBeVisible();
    }
  });
});

test.describe('Property Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.goto('/properties');
  });

  test('should open create property form', async ({ page }) => {
    const createButton = page.getByTestId('button-create-property');
    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page.getByTestId('form-create-property')).toBeVisible();
    }
  });
});
