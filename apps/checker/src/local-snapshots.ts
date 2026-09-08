import type { Snapshot } from '@mutuallens/core';

const DATABASE = 'mutuallens-local-snapshots';
const STORE = 'snapshots';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Local storage is unavailable. You can still use the checker without saving.',
        ),
      );
    request.onblocked = () =>
      reject(
        new Error('Close other checker tabs before changing local storage.'),
      );
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(
        new Error(
          'Local storage failed. Your in-memory result is still available.',
        ),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error('Local storage was interrupted. Please try again.'));
    };
  });
}
export const loadSnapshots = () =>
  operation<Snapshot[]>('readonly', (store) => store.getAll());
export const saveSnapshot = (snapshot: Snapshot) =>
  operation('readwrite', (store) => store.put(snapshot));
export const deleteSnapshots = () =>
  operation('readwrite', (store) => store.clear());
