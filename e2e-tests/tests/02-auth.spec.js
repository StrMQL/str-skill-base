/**
 * Authentication Tests (TC-004 ~ TC-007)
 */

const { test, expect } = require('@playwright/test');
const testData = require('./fixtures/test-data');
const { loginAsAdmin } = require('./helpers/auth-helper');

test.describe('Authentication', () => {
  
  test('TC-004: Admin login successfully', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[name="username"], input[placeholder*="用户名"], input[type="text"]', testData.admin.username);
    await page.fill('input[name="password"], input[placeholder*="密码"], input[type="password"]', testData.admin.password);
    
    // Click login
    await page.click('button:has-text("登录"), button[type="submit"]');
    
    // Wait for navigation to home
    await page.waitForURL('**/', { timeout: 10000 });
    
    // Verify logged in state
    await expect(page.locator('text=/admin|管理员/i').first()).toBeVisible();
    
    // Verify publish button is visible (for logged in users)
    const publishButton = page.locator('text=/发布|Publish/i').first();
    await expect(publishButton).toBeVisible();
  });

  test('TC-005: Login fails with wrong password', async ({ page }) => {
    await page.goto('/login');
    
    // Fill with wrong password
    await page.fill('input[name="username"], input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.invalidCredentials.wrongPassword);
    
    // Click login
    await page.click('button:has-text("登录"), button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('text=/错误|error|密码错误|invalid/i').first()).toBeVisible({ timeout: 5000 });
    
    // Verify still on login page
    expect(page.url()).toContain('/login');
  });

  test('TC-006: Login fails with non-existent user', async ({ page }) => {
    await page.goto('/login');
    
    // Fill with non-existent user
    await page.fill('input[name="username"], input[type="text"]', testData.invalidCredentials.nonExistentUser);
    await page.fill('input[type="password"]', 'password123');
    
    // Click login
    await page.click('button:has-text("登录"), button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('text=/错误|error|不存在|not found/i').first()).toBeVisible({ timeout: 5000 });
    
    // Verify still on login page
    expect(page.url()).toContain('/login');
  });

  test('TC-007: User logout successfully', async ({ page }) => {
    // Login first
    await loginAsAdmin(page);
    
    // Click user menu
    await page.click('[data-testid="user-menu"], .user-menu, header button:has-text("admin"), .avatar');
    
    // Click logout
    await page.click('text=/退出|logout|登出/i');
    
    // Wait for redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
    
    // Verify on login page
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });
});
