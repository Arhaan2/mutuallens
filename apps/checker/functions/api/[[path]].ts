import {
  capabilities,
  unavailableResponse,
} from '../../../../packages/acquisition/src/index';
import { sessionDigest } from '../../../../packages/acquisition/src/jobs';
import { CapacityError } from '../../../../packages/acquisition/src/store';
import { automaticConfigured, automaticService } from '../../server/automatic';
import type { RuntimeEnv } from '../../server/automatic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function headers(response: Response): Response {
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
async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Error('BAD_REQUEST');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BAD_REQUEST');
  let size = 0,
    text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        throw new Error('BAD_REQUEST');
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('BAD_REQUEST');
  return value as Record<string, unknown>;
}
function sessionToken(request: Request): string | null {
  const name =
    new URL(request.url).protocol === 'https:'
      ? '__Host-mutuallens-session'
      : 'mutuallens-local-session';
  const candidates = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith(name + '='));
  if (candidates.length !== 1) return null;
  const value = candidates[0]!.slice(name.length + 1);
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}
function sessionCookie(url: URL, token: string): string {
  const secure = url.protocol === 'https:';
  const name = secure
    ? '__Host-mutuallens-session'
    : 'mutuallens-local-session';
  // Five minutes of headroom keeps a one-hour job reachable through cleanup.
  return `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3900${secure ? '; Secure' : ''}`;
}
export async function handleApi(
  request: Request,
  env: RuntimeEnv = {},
): Promise<Response> {
  const url = new URL(request.url),
    mutates = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (
    mutates &&
    (request.headers.get('Origin') !== url.origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site')
  )
    return headers(Response.json({ code: 'ORIGIN_REJECTED' }, { status: 403 }));
  if (url.pathname === '/api/capabilities' && request.method === 'GET')
    return headers(
      Response.json(
        automaticConfigured(env)
          ? {
              release: 'preview',
              automatic: {
                enabled: true,
                status: 'available',
                reason:
                  'Public-account automatic checking is available within the free service capacity.',
              },
              ads: false,
            }
          : capabilities,
      ),
    );
  const path =
    /^\/api\/scans(?:\/([^/]+)(?:\/(status|advance|result))?)?$/.exec(
      url.pathname,
    );
  if (!path && url.pathname !== '/api/session')
    return headers(Response.json({ code: 'NOT_FOUND' }, { status: 404 }));
  if (!automaticConfigured(env)) return headers(unavailableResponse());
  try {
    const service = automaticService(env);
    if (url.pathname === '/api/session') {
      if (request.method !== 'POST')
        return headers(
          Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405 }),
        );
      const existing = sessionToken(request);
      const token =
        existing ||
        [...crypto.getRandomValues(new Uint8Array(32))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      return headers(
        new Response(null, {
          status: 204,
          headers: { 'Set-Cookie': sessionCookie(url, token) },
        }),
      );
    }
    const token = sessionToken(request);
    if (!token)
      return headers(
        Response.json({ code: 'SCAN_NOT_FOUND' }, { status: 404 }),
      );
    const session = await sessionDigest(token),
      id = path?.[1],
      action = path?.[2];
    if (!id && request.method === 'POST') {
      const body = await jsonBody(request);
      if (
        typeof body.username !== 'string' ||
        body.username.length > 100 ||
        typeof body.idempotencyKey !== 'string' ||
        !uuid.test(body.idempotencyKey)
      )
        throw new Error('BAD_REQUEST');
      return headers(
        Response.json(
          await service.create(session, body.idempotencyKey, body.username),
          { status: 202 },
        ),
      );
    }
    if (!id || !uuid.test(id))
      return headers(Response.json({ code: 'NOT_FOUND' }, { status: 404 }));
    if (action === 'status' && request.method === 'GET')
      return headers(Response.json(await service.status(session, id)));
    if (action === 'advance' && request.method === 'POST')
      return headers(Response.json(await service.advance(session, id)));
    if (!action && request.method === 'DELETE')
      return headers(Response.json(await service.cancel(session, id)));
    if (action === 'result' && request.method === 'GET') {
      const direction = url.searchParams.get('direction'),
        offsetText = url.searchParams.get('offset') ?? '0';
      if (
        !['followers', 'following'].includes(direction ?? '') ||
        !/^\d{1,12}$/.test(offsetText)
      )
        throw new Error('BAD_REQUEST');
      const offset = Number(offsetText);
      if (!Number.isSafeInteger(offset)) throw new Error('BAD_REQUEST');
      return headers(
        Response.json(
          await service.resultPage(
            session,
            id,
            direction as 'followers' | 'following',
            offset,
          ),
        ),
      );
    }
    return headers(
      Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405 }),
    );
  } catch (error) {
    if (error instanceof CapacityError)
      return headers(
        Response.json(
          { code: error.code, message: error.message },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      );
    if (error instanceof Error && error.message === 'SCAN_NOT_READY')
      return headers(
        Response.json(
          {
            code: 'SCAN_NOT_READY',
            message:
              'Collection is still running. Wait for its current status before downloading records.',
          },
          { status: 409 },
        ),
      );
    if (error instanceof Error && error.message === 'SCAN_NOT_FOUND')
      return headers(
        Response.json(
          {
            code: 'SCAN_NOT_FOUND',
            message: 'This scan is unavailable in this session or has expired.',
          },
          { status: 404 },
        ),
      );
    if (
      error instanceof Error &&
      (error.message === 'BAD_REQUEST' || error instanceof SyntaxError)
    )
      return headers(
        Response.json(
          {
            code: 'INVALID_INPUT',
            message: 'Enter a valid username and try again.',
          },
          { status: 400 },
        ),
      );
    return headers(
      Response.json(
        {
          code: 'AUTOMATIC_SERVICE_UNAVAILABLE',
          message:
            'Automatic checking could not continue safely. Local file comparison remains available.',
        },
        { status: 503 },
      ),
    );
  }
}
export const onRequest = (context: {
  request: Request;
  env?: RuntimeEnv;
}): Promise<Response> => handleApi(context.request, context.env);
