import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/browser-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx wrangler pages dev dist --port 5173 --ip 127.0.0.1',
      cwd: 'apps/checker',
      url: 'http://localhost:5173/api/capabilities',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    {
      command: 'npx wrangler pages dev dist --port 4321 --ip 127.0.0.1',
      cwd: 'apps/site',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
