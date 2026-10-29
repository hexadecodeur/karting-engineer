const DB_NAME = 'kart-engineer';
const DB_VERSION = 2;
const STORES = ['circuits', 'pilots', 'karts', 'setups', 'sessions', 'laps'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains('circuits')) {
        db.createObjectStore('circuits', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('pilots')) {
        db.createObjectStore('pilots', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('karts')) {
        db.createObjectStore('karts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('setups')) {
        const setups = db.createObjectStore('setups', { keyPath: 'id' });
        setups.createIndex('byKart', 'kartId', { unique: false });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('byCircuit', 'circuitId', { unique: false });
        sessions.createIndex('byPilot', 'pilotId', { unique: false });
        sessions.createIndex('byDate', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('laps')) {
        const laps = db.createObjectStore('laps', { keyPath: 'id' });
        laps.createIndex('bySession', 'sessionId', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store, tx);
  await txDone(tx);
  return result;
}

export async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => reqToPromise(store.getAll()));
}

export async function getById(storeName, id) {
  return withStore(storeName, 'readonly', (store) => reqToPromise(store.get(id)));
}

export async function put(storeName, value) {
  return withStore(storeName, 'readwrite', async (store) => {
    await reqToPromise(store.put(value));
    return value;
  });
}

export async function remove(storeName, id) {
  return withStore(storeName, 'readwrite', (store) => reqToPromise(store.delete(id)));
}

export async function getByIndex(storeName, indexName, value) {
  return withStore(storeName, 'readonly', (store) => {
    const index = store.index(indexName);
    return reqToPromise(index.getAll(value));
  });
}

export async function clearStore(storeName) {
  return withStore(storeName, 'readwrite', (store) => reqToPromise(store.clear()));
}

export async function count(storeName) {
  return withStore(storeName, 'readonly', (store) => reqToPromise(store.count()));
}

export function createId() {
  return crypto.randomUUID();
}

export async function initDb() {
  await openDb();
}

export { STORES };
