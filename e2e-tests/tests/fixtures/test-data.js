/**
 * Test data for E2E tests
 */

module.exports = {
  admin: {
    username: 'admin',
    password: 'admin123'
  },

  invalidCredentials: {
    shortUsername: 'ad',
    shortPassword: '12345',
    nonExistentUser: 'nonexistent',
    wrongPassword: 'wrongpassword'
  }
};
