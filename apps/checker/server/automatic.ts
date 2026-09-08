/// <reference types="@cloudflare/workers-types" />
import { ApifyClient } from '../../../packages/acquisition/src/apify';
import {
  ScanService,
  capacityReader,
} from '../../../packages/acquisition/src/jobs';
import { D1Driver, JobStore } from '../../../packages/acquisition/src/store';
import type { ScanJob } from '../../../packages/acquisition/src/jobs';
/** Bindings derive from Wrangler output; deployment strings are widened from disabled defaults. */
export type RuntimeEnv = Partial<{
  [K in keyof AutomaticEnv]: AutomaticEnv[K] extends string
    ? string
    : AutomaticEnv[K];
}>;
export function automaticConfigured(env: RuntimeEnv): boolean {
  return (
    env.AUTOMATIC_ENABLED === 'true' &&
    !!env.AUTOMATIC_VALIDATION_ID?.trim() &&
    !!env.APIFY_TOKEN?.trim() &&
    !!env.JOBS
  );
}
export function automaticService(
  env: RuntimeEnv,
  maintenance = false,
): ScanService {
  if (
    (!maintenance && !automaticConfigured(env)) ||
    !env.JOBS ||
    !env.APIFY_TOKEN
  )
    throw new Error('AUTOMATIC_UNAVAILABLE');
  return new ScanService(
    new JobStore<ScanJob>(new D1Driver(env.JOBS)),
    new ApifyClient({ token: env.APIFY_TOKEN }),
    {
      windowUsd: Number(env.AUTOMATIC_WINDOW_USD),
      jobUsd: Number(env.AUTOMATIC_JOB_USD),
      runUsd: Number(env.AUTOMATIC_RUN_USD),
      reserveUsd: Number(env.AUTOMATIC_RESERVE_USD),
      terminalEvidenceId: env.AUTOMATIC_VALIDATION_ID,
    },
    capacityReader(env.APIFY_TOKEN),
  );
}
