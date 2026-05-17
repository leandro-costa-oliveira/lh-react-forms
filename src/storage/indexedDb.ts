const INDEXED_DB_NAME = "lh-react-forms";
const INDEXED_DB_STORE = "forms";

export function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export async function ensureIndexedDbAvailable(): Promise<void> {
  const db = await openPersistDatabase();
  db.close();
}

export async function indexedDbGet<T>(key: string): Promise<T | undefined> {
  return withObjectStore("readonly", (store) => store.get(key));
}

export async function indexedDbSet(key: string, value: unknown): Promise<void> {
  await withObjectStore("readwrite", (store) => store.put(value, key));
}

export async function indexedDbRemove(key: string): Promise<void> {
  await withObjectStore("readwrite", (store) => store.delete(key));
}

async function openPersistDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(INDEXED_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB."));
  });
}

async function withObjectStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openPersistDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(INDEXED_DB_STORE, mode);
    const store = transaction.objectStore(INDEXED_DB_STORE);
    const request = handler(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha na operação do IndexedDB."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("Falha na transação do IndexedDB."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("Transação do IndexedDB abortada."));
    };
  });
}
