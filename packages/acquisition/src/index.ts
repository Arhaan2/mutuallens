/** Default unconfigured preview capability; configured routes use the server adapter. */
export const capabilities = Object.freeze({
  release: 'preview' as const,
  automatic: Object.freeze({
    enabled: false as const,
    status: 'blocked' as const,
    reason:
      'Automatic checking is awaiting provider account setup and authorized live validation. File comparison is available now.',
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
