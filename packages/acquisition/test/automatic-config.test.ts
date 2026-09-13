import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  automaticConfigured,
  automaticService,
} from '../../../apps/checker/server/automatic';

describe('automatic integration capability gate', () => {
  it('fails closed even when stale deployment variables remain configured', () => {
    expect(
      automaticConfigured({
        AUTOMATIC_ENABLED: 'true',
        AUTOMATIC_VALIDATION_ID: 'stale-synthetic-evidence',
        APIFY_TOKEN: 'synthetic-token',
        JOBS: {} as D1Database,
      }),
    ).toBe(false);
  });

  it('keeps deletion maintenance constructible without obsolete scan budgets', () => {
    expect(() =>
      automaticService(
        {
          APIFY_TOKEN: 'synthetic-token',
          JOBS: {} as D1Database,
        },
        true,
      ),
    ).not.toThrow();
  });
});
