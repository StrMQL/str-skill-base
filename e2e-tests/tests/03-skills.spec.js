/**
 * Skill Browse and Search Tests (TC-008)
 */

const { test, expect } = require('@playwright/test');

test.describe('Skill Browse and Search', () => {
  test('TC-008: Home page loads and displays skill list', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('title')).toHaveText(/Skill Base/i);

    await expect(page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]').first()).toBeVisible();

    await expect(page.locator('main, .main-content, #app > div').first()).toBeVisible();
  });
});
