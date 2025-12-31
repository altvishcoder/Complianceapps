import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('input-username')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('button-login')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByTestId('input-username').fill('invaliduser');
    await page.getByTestId('input-password').fill('wrongpassword');
    await page.getByTestId('button-login').click();
    
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    await page.getByTestId('button-logout').click();
    
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Session Persistence', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    
    await page.reload();
    
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId('login-form')).not.toBeVisible();
  });
});
