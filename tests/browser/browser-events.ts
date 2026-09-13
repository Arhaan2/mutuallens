import { test, type Request } from '@playwright/test';

/** React StrictMode intentionally aborts the first effect's GET in development.
 * Keep these exact lifecycle cancellations in the report; all other failures,
 * and every cancellation in the built preview, remain test failures. */
export function expectedDevelopmentAbort(request: Request): boolean {
  const expected =
    process.env.MUTUALLENS_TEST_MODE === 'dev' &&
    request.method() === 'GET' &&
    request.url() === 'http://localhost:5173/api/capabilities' &&
    /^(net::ERR_ABORTED|cancelled|Load request cancelled|NS_BINDING_ABORTED)$/.test(
      request.failure()?.errorText || '',
    );
  if (expected)
    test.info().annotations.push({
      type: 'expected-development-cleanup',
      description: `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    });
  return expected;
}
