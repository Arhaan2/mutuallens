import { describe, expect, it, vi } from 'vitest';
import { handleApi } from '../../apps/checker/functions/api/[[path]]';

describe('unavailable acquisition boundary (not live job authorization)', () => {
  it('publishes honest noindex and non-cacheable capability without secrets', async () => {
    const r = await handleApi(
      new Request('https://checker.test/api/capabilities'),
    );
    expect(await r.json()).toMatchObject({
      release: 'preview',
      automatic: { enabled: false },
      ads: false,
    });
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(r.headers.has('Access-Control-Allow-Origin')).toBe(false);
    expect(r.headers.has('Set-Cookie')).toBe(false);
  });
  it.each(['POST', 'DELETE', 'PATCH'])(
    'rejects cross-origin or missing-origin %s requests',
    async (method) => {
      for (const origin of [
        null,
        'https://public.test',
        'null',
        'https://checker.test.evil.test',
      ]) {
        const headers = origin ? { Origin: origin } : undefined;
        const r = await handleApi(
          new Request('https://checker.test/api/scans', { method, headers }),
        );
        expect(r.status).toBe(403);
      }
    },
  );
  it('cannot create jobs, fetch arbitrary URLs, incur provider calls, or return synthetic results', async () => {
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network'));
    try {
      for (let i = 0; i < 4; i++) {
        const r = await handleApi(
          new Request('https://checker.test/api/scans', {
            method: 'POST',
            headers: { Origin: 'https://checker.test' },
            body: JSON.stringify({
              username: 'http://169.254.169.254/latest/meta-data',
            }),
          }),
        );
        expect(r.status).toBe(503);
        expect(await r.json()).toMatchObject({
          code: 'AUTOMATIC_UNAVAILABLE',
          complete: false,
          results: null,
        });
      }
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it.each(['status', 'advance', 'result'])(
    'job %s cannot expose a graph to any session',
    async (action) => {
      const r = await handleApi(
        new Request(`https://checker.test/api/scans/synthetic-id/${action}`),
      );
      expect(r.status).toBe(503);
      expect(await r.json()).toHaveProperty('results', null);
    },
  );
  it('unknown API paths are JSON 404s', async () => {
    const r = await handleApi(new Request('https://checker.test/api/unknown'));
    expect(r.status).toBe(404);
  });
});
