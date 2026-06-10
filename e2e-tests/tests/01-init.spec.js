/**
 * System Initialization Tests (TC-001 ~ TC-003)
 */

const { test, expect } = require('@playwright/test');
const testData = require('./fixtures/test-data');

test.describe('System Initialization', () => {
  test('TC-001: First visit redirects to initialization page', async ({ page }) => {
    await page.goto('/');
    
    // Check if redirected to init page or already initialized
    const url = page.url();
    
    if (url.includes('/init')) {
      // Verify init page elements
      await expect(page.locator('h1, h2').filter({ hasText: /初始化|Initialize/i })).toBeVisible();
      await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button:has-text("创建管理员账号"), button:has-text("Create")')).toBeVisible();
    } else {
      // System already initialized, skip this test
      test.skip();
    }
  });

  test('TC-002: Create admin account successfully', async ({ page }) => {
    await page.goto('/');
    
    // Only run if on init page
    if (!page.url().includes('/init')) {
      test.skip();
    }
    
    // Fill init form
    await page.fill('input[name="username"], input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    
    // Submit
    await page.click('button:has-text("创建管理员账号"), button[type="submit"]');
    
    // Wait for success message or redirect
    await Promise.race([
      page.waitForURL('**/login', { timeout: 10000 }),
      page.waitForSelector('text=/成功|success/i', { timeout: 10000 })
    ]);
    
    // Verify redirect to login
    expect(page.url()).toContain('/login');
  });

  test('TC-003: Validation fails with invalid input', async ({ page }) => {
    await page.goto('/');
    
    // Only run if on init page
    if (!page.url().includes('/init')) {
      test.skip();
    }
    
    // Fill with invalid data
    await page.fill('input[name="username"], input[type="text"]', testData.invalidCredentials.shortUsername);
    await page.fill('input[type="password"]', testData.invalidCredentials.shortPassword);
    
    // Submit
    await page.click('button:has-text("创建管理员账号"), button[type="submit"]');
    
    // Verify error messages
    const errorVisible = await page.locator('text=/错误|error|至少|minimum/i').first().isVisible({ timeout: 5000 });
    expect(errorVisible).toBeTruthy();
  });
});
