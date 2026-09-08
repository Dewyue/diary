const DB_NAME = 'diary.audio.v1';
const DB_VERSION = 1;
const STORE = 'clips';

type ClipRecord = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('无法打开语音存储'));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('语音存储操作失败'));
  });
}

export async function putVoiceBlob(
  id: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const record: ClipRecord = {
      id,
      blob,
      mimeType,
      createdAt: new Date().toISOString(),
    };
    await requestToPromise(tx.objectStore(STORE).put(record));
  } finally {
    db.close();
  }
}

export async function getVoiceBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const record = await requestToPromise(
      tx.objectStore(STORE).get(id) as IDBRequest<ClipRecord | undefined>,
    );
    return record?.blob ?? null;
  } finally {
    db.close();
  }
}

export async function deleteVoiceBlob(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function deleteVoiceBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await Promise.all(ids.map((id) => requestToPromise(store.delete(id))));
  } finally {
    db.close();
  }
}
