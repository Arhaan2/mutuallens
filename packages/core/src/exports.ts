/* eslint-disable no-control-regex -- Security validation explicitly rejects control characters. */
import type { AccountRecord, Dataset } from './types';
import { compareDataset } from './identity';

function csvCell(value: string): string {
  // Spreadsheet programs may ignore leading whitespace before a formula marker.
  const safe =
    /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(
  records: AccountRecord[],
  context: { scope: string; limitations?: string[] } = {
    scope:
      'Based on supplied records; not a verified current Instagram relationship snapshot.',
  },
): string {
  const header = [
    'username',
    'original_username',
    'id',
    'display_name',
    'source',
    'comparison_scope',
    'limitations',
  ];
  return (
    [
      header,
      ...records.map((record) => [
        record.username,
        record.originalUsername,
        record.id ?? '',
        record.displayName ?? '',
        record.source,
        context.scope,
        (context.limitations ?? []).join(' '),
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n') + '\r\n'
  );
}

export function exportDataset(dataset: Dataset): string {
  const comparison = compareDataset(dataset);
  return JSON.stringify(
    {
      ...dataset,
      exportScope: dataset.sample
        ? 'Synthetic example only. No Instagram account was checked.'
        : dataset.comparisonBasis === 'supplied_files'
          ? 'Based on your uploaded files, not independently verified current Instagram relationships.'
          : 'Based on acquired source records and their recorded completeness; not an atomic live snapshot.',
      exportLimitations: comparison.warnings,
    },
    null,
    2,
  );
}
