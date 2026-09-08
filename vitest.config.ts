import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/review/**/*.test.ts',
    ],
    testTimeout: 20000,
  },
});
