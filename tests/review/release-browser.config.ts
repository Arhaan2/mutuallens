import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'release-browser.spec.ts',
  timeout: 45000,
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/independent-release',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/independent-release.json' }],
  ],
  use: {
    baseURL: 'http://localhost:4424',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command:
        'node node_modules/wrangler/bin/wrangler.js pages dev dist --cwd apps/checker --port 4424 --ip 127.0.0.1 --inspector-port 0',
      cwd: '../..',
      url: 'http://127.0.0.1:4424/api/capabilities',
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    {
      command:
        'node node_modules/wrangler/bin/wrangler.js pages dev dist --cwd apps/site --port 4423 --ip 127.0.0.1 --inspector-port 0',
      cwd: '../..',
      url: 'http://127.0.0.1:4423',
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    {
      command: 'node tests/review/release-project-server.mjs',
      cwd: '../..',
      url: 'http://127.0.0.1:4425/mutuallens/',
      reuseExistingServer: false,
    },
  ],
});
