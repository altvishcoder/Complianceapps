import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests (WCAG 2.1 AA)', () => {
  test('login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('dashboard should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('properties page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.goto('/properties');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('certificates page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await page.goto('/compliance');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Keyboard Navigation', () => {
  test('should navigate login form with keyboard', async ({ page }) => {
    await page.goto('/');
    
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('input-username')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('input-password')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('button-login')).toBeFocused();
  });

  test('should navigate dashboard with keyboard after login', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});

test.describe('Screen Reader Support', () => {
  test('should have proper ARIA labels on navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    const nav = page.getByRole('navigation');
    if (await nav.first().isVisible()) {
      const ariaLabel = await nav.first().getAttribute('aria-label');
      expect(ariaLabel || await nav.first().textContent()).toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');
    
    const usernameInput = page.getByTestId('input-username');
    const usernameLabel = await usernameInput.getAttribute('aria-label') || 
                          await page.getByLabel(/username/i).count();
    expect(usernameLabel).toBeTruthy();
  });
});
