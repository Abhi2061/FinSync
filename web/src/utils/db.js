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

export const addCategory = async (cat) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const index = store.index('name');
  const existing = await index.get(cat.name);

  if (!existing) {
    await store.add({
      ...cat,
      lastModified: new Date().toISOString(),
      deleted: false
    });
  } else if (existing.deleted) {
    // Restore the deleted category
    existing.color = cat.color;
    existing.lastModified = new Date().toISOString();
    existing.deleted = false;
    await store.put(existing);
  }
  await tx.done;
};

export const updateCategory = async (id, updates) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const cat = await store.get(id);
  if (cat) {
    cat.name = updates.name;
    cat.color = updates.color;
    cat.lastModified = new Date().toISOString();
    cat.deleted = false;
    await store.put(cat);
  }
  await tx.done;
};

export const deleteCategory = async (id) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const cat = await store.get(id);
  if (cat) {
    cat.deleted = true;
    cat.lastModified = new Date().toISOString();
    await store.put(cat);
  }
  await tx.done;
};

export const getCategories = async () => {
  const db = await initDB();
  const all = await db.getAll('categories');
  return all.filter(cat => !cat.deleted);
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



