/**
 * Authentication helper functions for E2E tests
 */

const testData = require('../fixtures/test-data');

async function login(page, username, password) {
  await page.goto('/login');

  await page.fill('input[name="username"], input[placeholder*="用户名"], input[type="text"]', username);
  await page.fill('input[name="password"], input[placeholder*="密码"], input[type="password"]', password);

  await page.click('button:has-text("登录"), button[type="submit"]');

  await page.waitForLoadState('networkidle');
}

async function loginAsAdmin(page) {
  await login(page, testData.admin.username, testData.admin.password);
}

module.exports = {
  loginAsAdmin
};
