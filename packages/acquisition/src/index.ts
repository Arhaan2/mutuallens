/** Server-only boundary. No source adapter is approved; no upstream calls are possible. */
export const capabilities = Object.freeze({
  release: 'preview' as const,
  automatic: Object.freeze({
    enabled: false as const,
    status: 'blocked' as const,
    reason:
      'Automatic checks are not available: complete-list access at the live target scale and a recurring zero-cash allowance have not been verified.',
  }),
  ads: false as const,
});

export function unavailableResponse(): Response {
  return Response.json(
    {
      code: 'AUTOMATIC_UNAVAILABLE',
      message: capabilities.automatic.reason,
      complete: false,
      results: null,
    },
    { status: 503 },
  );
}
