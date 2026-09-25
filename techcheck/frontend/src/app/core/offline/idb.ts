const DB_NAME = 'techcheck-offline';
const DB_VERSION = 1;

export const STORE_CACHE = 'cache';
export const STORE_OUTBOX = 'outbox';

export interface CacheEntry {
  key: string;
  url: string;
  userId: string;
  body: unknown;
  guardadoEn: string;
}

export interface OutboxEntry {
  id?: number;
  userId: string;
  method: 'POST' | 'PUT';
  url: string;
  body: any;
  equipoId?: string;
  descripcion: string;
  creadoEn: string;
  intentos: number;
  error?: string;
  fallido?: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) db.createObjectStore(STORE_OUTBOX, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function tx<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return abrir().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const idb = {
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return tx<T>(store, 'readonly', s => s.get(key));
  },
  getAll<T>(store: string): Promise<T[]> {
    return tx<T[]>(store, 'readonly', s => s.getAll());
  },
  put<T>(store: string, value: T): Promise<IDBValidKey> {
    return tx<IDBValidKey>(store, 'readwrite', s => s.put(value));
  },
  delete(store: string, key: IDBValidKey): Promise<void> {
    return tx<void>(store, 'readwrite', s => { s.delete(key); });
  },
  clear(store: string): Promise<void> {
    return tx<void>(store, 'readwrite', s => { s.clear(); });
  },
};
