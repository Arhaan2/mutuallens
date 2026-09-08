import {
  capabilities,
  unavailableResponse,
} from '../../../../packages/acquisition/src/index';

/** No job/session data exists in the preview. Fail closed before any storage or upstream request. */
export async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let response: Response;
  if (url.pathname === '/api/capabilities' && request.method === 'GET') {
    response = Response.json(capabilities);
  } else if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    (request.headers.get('Origin') !== url.origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site')
  ) {
    response = Response.json({ code: 'ORIGIN_REJECTED' }, { status: 403 });
  } else if (
    /^\/api\/scans(?:\/[^/]+(?:\/(?:status|advance|result))?)?$/.test(
      url.pathname,
    )
  ) {
    // Deliberately do not consume bodies or usernames: no verified acquisition source is connected.
    response = unavailableResponse();
  } else {
    response = Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );
  return response;
}

// This route uses only the standard Fetch API and has no environment bindings.
export const onRequest = (context: { request: Request }): Promise<Response> =>
  handleApi(context.request);
