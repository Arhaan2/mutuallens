import { normalizeUsername, validId } from '@mutuallens/core';
import type { Snapshot } from '@mutuallens/core';

const DATABASE = 'mutuallens-local-snapshots';
const STORE = 'snapshots';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      settled = true;
      reject(
        new Error(
          'Local storage is unavailable. You can still use the checker without saving.',
        ),
      );
    };
    request.onblocked = () => {
      settled = true;
      reject(
        new Error('Close other checker tabs before changing local storage.'),
      );
    };
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  let database: IDBDatabase;
  try {
    database = await open();
  } catch {
    throw new Error(
      'Local storage is unavailable. You can still use the checker without saving. Close other checker tabs or check browser storage settings.',
    );
  }
  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      transaction.onerror = transaction.onabort = () => {
        database.close();
        reject(
          new Error(
            'Local storage failed. Your in-memory result is still available. Please retry or check browser storage settings.',
          ),
        );
      };
    } catch {
      database.close();
      reject(
        new Error(
          'Local storage failed. Your in-memory result is still available. Please check browser storage settings.',
        ),
      );
    }
  });
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const timestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
/** Browser storage is mutable, not a trusted typed source. Reject damaged records before rendering. */
export function validSnapshot(value: unknown): value is Snapshot {
  try {
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      typeof value.id !== 'string' ||
      !value.id ||
      !timestamp(value.savedAt)
    )
      return false;
    const d = value.dataset;
    if (
      !object(d) ||
      d.schemaVersion !== 1 ||
      typeof d.sample !== 'boolean' ||
      !timestamp(d.importedAt) ||
      !object(d.account) ||
      typeof d.account.username !== 'string'
    )
      return false;
    normalizeUsername(d.account.username);
    validId(d.account.id);
    for (const direction of ['followers', 'following']) {
      const list = d[direction];
      if (
        !object(list) ||
        !Array.isArray(list.records) ||
        !object(list.metadata)
      )
        return false;
      const m = list.metadata;
      if (
        typeof m.source !== 'string' ||
        typeof m.version !== 'string' ||
        typeof m.terminal !== 'boolean' ||
        !['complete_for_source', 'partial', 'unverified'].includes(
          String(m.completeness),
        ) ||
        !count(m.rawCount) ||
        !count(m.uniqueCount) ||
        !count(m.pages) ||
        (m.expectedCount !== undefined && !count(m.expectedCount)) ||
        !Array.isArray(m.warnings) ||
        !m.warnings.every((w) => typeof w === 'string') ||
        ![m.startedAt, m.endedAt].every((t) => t === null || timestamp(t))
      )
        return false;
      if (
        !list.records.every((row) => {
          if (
            !object(row) ||
            typeof row.username !== 'string' ||
            typeof row.originalUsername !== 'string' ||
            typeof row.source !== 'string' ||
            (row.displayName !== undefined &&
              typeof row.displayName !== 'string')
          )
            return false;
          validId(row.id);
          return normalizeUsername(row.username) === row.username;
        })
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
export async function loadSnapshots(): Promise<Snapshot[]> {
  const stored = await operation<unknown[]>('readonly', (store) =>
    store.getAll(),
  );
  if (!stored.every(validSnapshot))
    throw new Error(
      'Saved snapshot data is damaged or incompatible. It was not loaded or changed. You can delete local snapshots and continue with a fresh import.',
    );
  return stored;
}
export const saveSnapshot = (snapshot: Snapshot) =>
  operation('readwrite', (store) => store.put(snapshot));
export const deleteSnapshots = () =>
  operation('readwrite', (store) => store.clear());
