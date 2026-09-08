/** Strict UTC timestamps reject calendar rollover and never use save/import times as collection evidence. */
export function knownCollectionDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return false;
  const canonical = new Date(timestamp).toISOString();
  const expected = value.includes('.')
    ? value.replace(
        /\.(\d{1,3})Z$/,
        (_, fraction: string) => `.${fraction.padEnd(3, '0')}Z`,
      )
    : value.replace('Z', '.000Z');
  return canonical === expected;
}
