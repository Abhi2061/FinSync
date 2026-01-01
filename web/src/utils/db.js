import { openDB } from 'idb';

const DB_NAME = 'finsync-db';
const STORE_NAME = 'transactions';
const CAT_STORE_NAME = 'categories';

export const initDB = async () => {
  return openDB(DB_NAME, 3, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('groupId', 'groupId', { unique: false });
      } else if (oldVersion < 2) {
        const store = transaction.objectStore(STORE_NAME);
        store.createIndex('groupId', 'groupId', { unique: false });
      }

      if (!db.objectStoreNames.contains(CAT_STORE_NAME)) {
        const catStore = db.createObjectStore(CAT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        catStore.createIndex('name', 'name', { unique: false });
        catStore.createIndex('groupId', 'groupId', { unique: false });
      } else {
        const catStore = transaction.objectStore(CAT_STORE_NAME);

        if (oldVersion < 2) {
          catStore.createIndex('groupId', 'groupId', { unique: false });
        }

        if (oldVersion < 3) {
          // Fix for "ConstraintError": Name should not be unique globally anymore
          if (catStore.indexNames.contains('name')) {
            catStore.deleteIndex('name');
          }
          catStore.createIndex('name', 'name', { unique: false });
        }
      }
    }
  });
};

export const addCategory = async (cat) => {
  const db = await initDB();
  const tx = db.transaction(CAT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CAT_STORE_NAME);

  // Logic change: we can't rely on global name index anymore if we want same name in diff groups.
  // But for now, let's just add it. The sync logic handles duplicates/IDs.

  await store.put({
    ...cat,
    lastModified: new Date().toISOString(),
    deleted: false
  });

  await tx.done;
};

// Helper for creating NEW categories with guaranteed UUID
export const createCategory = async ({ name, color, groupId, createdBy }) => {
  const id = self.crypto.randomUUID(); // Native UUID generation
  await addCategory({
    id,
    name,
    color,
    groupId,
    createdBy
  });
  return id;
};

export const updateCategory = async (id, updates) => {
  const db = await initDB();
  const tx = db.transaction(CAT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CAT_STORE_NAME);
  const cat = await store.get(id);
  if (cat) {
    Object.assign(cat, updates); // Merge updates
    cat.lastModified = new Date().toISOString();
    cat.deleted = false;
    await store.put(cat);
  }
  await tx.done;
};

export const deleteCategory = async (id) => {
  const db = await initDB();
  const tx = db.transaction(CAT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CAT_STORE_NAME);
  const cat = await store.get(id);
  if (cat) {
    cat.deleted = true;
    cat.lastModified = new Date().toISOString();
    await store.put(cat);
  }
  await tx.done;
};

export const getCategories = async (groupId) => {
  const db = await initDB();
  const index = db.transaction(CAT_STORE_NAME).store.index('groupId');
  // If groupId is not provided, maybe return all? Or return empty?
  // Let's assume groupId is required safely.
  let all;
  if (groupId) {
    all = await index.getAll(groupId);
  } else {
    all = await db.getAll(CAT_STORE_NAME);
  }
  return all.filter(cat => !cat.deleted);
};

export const addTransaction = async (txn) => {
  const db = await initDB();
  await db.put(STORE_NAME, txn); // Use put to allow overwrite if ID exists
};

export const getTransactionsByDateRange = async (start, end, groupId) => {
  const db = await initDB();
  let all;
  if (groupId) {
    const index = db.transaction(STORE_NAME).store.index('groupId');
    all = await index.getAll(groupId);
  } else {
    all = await db.getAll(STORE_NAME);
  }

  return all.filter(txn => {
    const d = new Date(txn.date);
    return d >= new Date(start) && d <= new Date(end) && !txn.deleted;
  });
};

export const deleteTransaction = async (id) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
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



