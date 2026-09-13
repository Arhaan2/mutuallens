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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command:
      process.env.MUTUALLENS_TEST_MODE === 'dev'
        ? 'npm run dev'
        : 'npm run preview',
    wait: { stdout: /\[MutualLens\] READY/ },
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
