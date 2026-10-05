// Rolls live in IndexedDB on this device only.

const DB = 'touch-grass', STORE = 'rolls';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const saveRoll = roll => tx('readwrite', s => s.put(roll));
export const getRoll = id => tx('readonly', s => s.get(id));
export const deleteRoll = id => tx('readwrite', s => s.delete(id));
export const listRolls = async () =>
  (await tx('readonly', s => s.getAll())).sort((a, b) => b.createdAt - a.createdAt);
