import { beforeEach, describe, it, expect, vi } from 'vitest';
const service = vi.hoisted(() => ({
  create: vi.fn(),
  status: vi.fn(),
  advance: vi.fn(),
  cancel: vi.fn(),
  resultPage: vi.fn(),
}));
vi.mock('../../apps/checker/server/automatic', () => ({
  automaticConfigured: () => true,
  automaticService: () => service,
}));
import { handleApi } from '../../apps/checker/functions/api/[[path]]';
import { sessionDigest } from '../../packages/acquisition/src/jobs';
const origin = 'https://checker.test',
  id = '11111111-1111-4111-8111-111111111111',
  token = 'a'.repeat(64);
const request = (
  path: string,
  method = 'GET',
  body?: string,
  extra: Record<string, string> = {},
) =>
  new Request(origin + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: '__Host-mutuallens-session=' + token,
      'Content-Type': 'application/json',
      ...extra,
    },
    body,
  });
beforeEach(() => vi.resetAllMocks());
describe('configured session API boundary; mocked service, no provider calls', () => {
  it('issues a host-only HTTP-only secure cookie and never serializes the credential', async () => {
    const r = await handleApi(
      request('/api/session', 'POST', undefined, { Cookie: '' }),
    );
    expect(r.status).toBe(204);
    expect(r.headers.get('set-cookie')).toMatch(
      /^__Host-mutuallens-session=[0-9a-f]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=3600; Secure$/,
    );
    expect(await r.text()).toBe('');
  });
  it('keeps an existing same-session cookie without resetting its lifetime', async () => {
    const r = await handleApi(request('/api/session', 'POST'));
    expect(r.status).toBe(204);
    expect(r.headers.has('set-cookie')).toBe(false);
  });
  it.each([
    '',
    '__Host-mutuallens-session=invalid',
    `__Host-mutuallens-session=${token}; __Host-mutuallens-session=${token}`,
  ])(
    'rejects missing/malformed/duplicate ownership cookies',
    async (Cookie) => {
      const r = await handleApi(
        request(`/api/scans/${id}/status`, 'GET', undefined, { Cookie }),
      );
      expect(r.status).toBe(404);
      expect(service.status).not.toHaveBeenCalled();
    },
  );
  it('hashes ownership before asking the durable service for status', async () => {
    service.status.mockResolvedValue({ id, status: 'running' });
    const r = await handleApi(request(`/api/scans/${id}/status`));
    expect(r.status).toBe(200);
    expect(service.status).toHaveBeenCalledWith(await sessionDigest(token), id);
    expect(await r.text()).not.toContain(token);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-robots-tag')).toContain('noindex');
    expect(r.headers.has('access-control-allow-origin')).toBe(false);
  });
  it.each(['POST', 'DELETE'])(
    'rejects cross-site %s even with a valid cookie',
    async (method) => {
      const r = await handleApi(
        request(`/api/scans/${id}`, method, undefined, {
          Origin: 'https://public.test',
        }),
      );
      expect(r.status).toBe(403);
      expect(service.cancel).not.toHaveBeenCalled();
      expect(service.create).not.toHaveBeenCalled();
    },
  );
  it('validates the bounded JSON create body and keeps the same idempotency key', async () => {
    service.create.mockResolvedValue({ id, status: 'queued' });
    let r = await handleApi(
      request(
        '/api/scans',
        'POST',
        JSON.stringify({ username: 'synthetic_target', idempotencyKey: id }),
      ),
    );
    expect(r.status).toBe(202);
    expect(service.create).toHaveBeenCalledWith(
      await sessionDigest(token),
      id,
      'synthetic_target',
    );
    service.create.mockClear();
    for (const body of [
      'x'.repeat(2049),
      '{',
      JSON.stringify({ username: 'synthetic_target', idempotencyKey: 'bad' }),
    ]) {
      r = await handleApi(request('/api/scans', 'POST', body));
      expect(r.status).toBe(400);
    }
    expect(service.create).not.toHaveBeenCalled();
  });
  it('translates private internal errors without exposing them', async () => {
    service.status.mockRejectedValue(
      new Error('private graph/token/database details'),
    );
    const r = await handleApi(request(`/api/scans/${id}/status`));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('private graph');
  });
  it('rejects result offsets and waits for terminal jobs', async () => {
    const r = await handleApi(
      request(`/api/scans/${id}/result?direction=followers&offset=-1`),
    );
    expect(r.status).toBe(400);
    expect(service.resultPage).not.toHaveBeenCalled();
    service.resultPage.mockRejectedValue(new Error('SCAN_NOT_READY'));
    expect(
      (
        await handleApi(
          request(`/api/scans/${id}/result?direction=following&offset=200`),
        )
      ).status,
    ).toBe(409);
    expect(service.resultPage).toHaveBeenCalledWith(
      await sessionDigest(token),
      id,
      'following',
      200,
    );
  });
});
