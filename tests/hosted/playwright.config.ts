import { defineConfig } from '@playwright/test';
const checkerOrigin =
  process.env.MUTUALLENS_HOSTED_CHECKER_ORIGIN ??
  'https://codex-ui-functional-repair.mutuallens-app.pages.dev';

export default defineConfig({
  testDir: '.',
  testMatch: 'hosted.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: '../../test-results/hosted/artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/hosted/results.json' }],
  ],
  use: {
    baseURL: checkerOrigin,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
