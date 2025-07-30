import { openDB } from 'idb';

const DB_NAME = 'finsync-db';
const STORE_NAME = 'transactions';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        catStore.createIndex('name', 'name', { unique: true });
      }
    }
  });
};

export const getCategories = async () => {
  const db = await initDB();
  return await db.getAll('categories');
};

export const addCategory = async (name) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const index = store.index('name');
  const existing = await index.get(name);
  if (!existing) {
    await store.add({ name });
  }
  await tx.done;
};

export const addTransaction = async (txn) => {
  const db = await initDB();
  await db.add(STORE_NAME, txn);
};

export const getTransactionsByDateRange = async (start, end) => {
  const db = await initDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter(txn => {
    const d = new Date(txn.date);
    return d >= new Date(start) && d <= new Date(end);
  });
};

export const deleteTransaction = async (id) => {
  try {
    const db = await initDB();
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const txn = await store.get(id);
    if (txn) {
      txn.deleted = true;
      txn.lastModified = new Date().toISOString();
      await store.put(txn);
    }
    await tx.done;
  } catch (error) {
    throw new Error("Failed to soft delete transaction");
  }
};



