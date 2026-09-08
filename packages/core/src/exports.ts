/* eslint-disable no-control-regex -- Security validation explicitly rejects control characters. */
import type { AccountRecord, Dataset } from './types';

function csvCell(value: string): string {
  // Spreadsheet programs may ignore leading whitespace before a formula marker.
  const safe =
    /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(records: AccountRecord[]): string {
  const header = [
    'username',
    'original_username',
    'id',
    'display_name',
    'source',
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
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n') + '\r\n'
  );
}

export function exportDataset(dataset: Dataset): string {
  return JSON.stringify(dataset, null, 2);
}
