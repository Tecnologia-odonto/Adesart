const DB_NAME = 'adesart-pending-files';
const STORE_NAME = 'files';

interface PendingFileRecord {
  id: string;
  userId: string;
  modalName: string;
  slotKey: string;
  file: Blob;
  name: string;
  type: string;
  lastModified: number;
  createdAt: number;
}

function buildRecordId(userId: string, modalName: string, slotKey: string) {
  return `${userId}:${modalName}:${slotKey}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    handler(store, resolve, reject);
  });
}

export async function savePendingFile(
  userId: string,
  modalName: string,
  slotKey: string,
  file: File
) {
  const record: PendingFileRecord = {
    id: buildRecordId(userId, modalName, slotKey),
    userId,
    modalName,
    slotKey,
    file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    createdAt: Date.now(),
  };

  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadPendingFile(
  userId: string,
  modalName: string,
  slotKey: string
): Promise<File | null> {
  const record = await withStore<PendingFileRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(buildRecordId(userId, modalName, slotKey));
    request.onsuccess = () => resolve((request.result as PendingFileRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  if (!record) {
    return null;
  }

  return new File([record.file], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  });
}

export async function clearPendingFile(userId: string, modalName: string, slotKey: string) {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(buildRecordId(userId, modalName, slotKey));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
