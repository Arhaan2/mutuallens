import { automaticService } from '../../checker/server/automatic';
import type { RuntimeEnv } from '../../checker/server/automatic';
import { eraseExpiredJobs } from '../../../packages/acquisition/src/jobs';
import type { ScanJob } from '../../../packages/acquisition/src/jobs';
import { D1Driver, JobStore } from '../../../packages/acquisition/src/store';
/** Operator-only scheduled handler; no public data or maintenance HTTP endpoint. */
export default {
  async scheduled(_event: unknown, env: RuntimeEnv): Promise<void> {
    // Pausing new scans must never pause deletion of existing expired data.
    if (!env.JOBS) return;
    await eraseExpiredJobs(
      new JobStore<ScanJob>(new D1Driver(env.JOBS)),
      Date.now(),
    );
    if (env.APIFY_TOKEN) await automaticService(env, true).cleanupExpired();
  },
  fetch(): Response {
    return new Response('Not found', { status: 404 });
  },
};
