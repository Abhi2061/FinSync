import { db, auth } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { initDB } from './db';
import { toast } from 'react-toastify';

const now = () => new Date().toISOString();

const withDefaults = (item) => ({
  ...item,
  lastModified: item.lastModified || now(),
  deleted: item.deleted ?? false,
});

// 🔁 Pull from Firestore → Local (Transactions)
export const syncFromFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const firestoreRef = collection(db, 'users', user.uid, 'transactions');
  const snapshot = await getDocs(firestoreRef);
  const localDB = await initDB();
  const tx = localDB.transaction('transactions', 'readwrite');
  const store = tx.store;
  const localTxns = await store.getAll();
  const localMap = new Map(localTxns.map(txn => [txn.id, txn]));

  for (const docSnap of snapshot.docs) {
    const cloudTxn = withDefaults({ ...docSnap.data(), id: docSnap.id });
    const localTxn = localMap.get(cloudTxn.id);
    const localTime = new Date(localTxn?.lastModified || 0);
    const cloudTime = new Date(cloudTxn.lastModified);

    if (!localTxn || cloudTime > localTime) {
      await store.put(cloudTxn);
    }
  }

  await tx.done;
};

// 🔁 Push to Firestore ← Local (Transactions)
export const syncToFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const localDB = await initDB();

  // Step 1: Get all local transactions
  const tx = localDB.transaction('transactions', 'readonly');
  const localTransactions = await tx.store.getAll();

  // Step 2: Fetch all cloud transactions
  const cloudRef = collection(db, 'users', user.uid, 'transactions');
  const cloudSnap = await getDocs(cloudRef);
  const cloudMap = new Map(cloudSnap.docs.map(d => [d.id, d.data()]));

  const updatedLocally = [];

  // Step 3: Compare and collect updates (both local and cloud)
  for (const txn of localTransactions) {
    let updated = false;

    // Fill missing fields
    if (!('lastModified' in txn)) {
      txn.lastModified = new Date().toISOString();
      updated = true;
    }

    if (!('deleted' in txn)) {
      txn.deleted = false;
      updated = true;
    }

    const cloudTxn = cloudMap.get(String(txn.id));
    const cloudTime = new Date(cloudTxn?.lastModified || 0);
    const localTime = new Date(txn.lastModified);

    // Push to cloud if newer locally or missing in cloud
    if (!cloudTxn || localTime > cloudTime) {
      await setDoc(doc(cloudRef, String(txn.id)), {
        ...txn,
        userId: user.uid,
      });
    }

    if (updated) {
      updatedLocally.push(txn);
    }
  }

  // Step 4: Safely update local database AFTER Firestore push
  if (updatedLocally.length > 0) {
    const writeTx = localDB.transaction('transactions', 'readwrite');
    const store = writeTx.store;
    for (const txn of updatedLocally) {
      store.put(txn);
    }
    await writeTx.done;
  }
};

// 🔁 Pull Firestore → Local (Categories)
export const syncCategoriesFromFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const cloudSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
  const cloudCategories = cloudSnap.docs.map(doc => withDefaults({
    ...doc.data(),
    id: parseInt(doc.id),
  }));

  const localDB = await initDB();
  const tx = localDB.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const nameIndex = store.index('name');

  for (const cat of cloudCategories) {
    try {
      const existing = await nameIndex.get(cat.name);
      if (existing) {
        const cloudTime = new Date(cat.lastModified);
        const localTime = new Date(existing.lastModified || 0);

        if (cloudTime > localTime) {
          await store.put(cat);
        }
      } else {
        await store.add(cat);
      }
    } catch (error) {
      console.error("Error syncing category:", cat.name, error);
    }
  }

  await tx.done;
};

// 🔁 Push Local → Firestore (Categories)
export const syncCategoriesToFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const localDB = await initDB();

  // Step 1: Get all local categories
  const tx = localDB.transaction('categories', 'readonly');
  const localCategories = await tx.store.getAll();

  // Step 2: Get all cloud categories
  const cloudRef = collection(db, 'users', user.uid, 'categories');
  const cloudSnap = await getDocs(cloudRef);
  const cloudMap = new Map(cloudSnap.docs.map(d => [d.id, d.data()]));

  const updatedLocally = [];

  // Step 3: Sync logic
  for (const cat of localCategories) {
    let updated = false;

    if (!('lastModified' in cat)) {
      cat.lastModified = new Date().toISOString();
      updated = true;
    }

    if (!('deleted' in cat)) {
      cat.deleted = false;
      updated = true;
    }

    const cloudCat = cloudMap.get(String(cat.id));
    const cloudTime = new Date(cloudCat?.lastModified || 0);
    const localTime = new Date(cat.lastModified);

    if (!cloudCat || localTime > cloudTime) {
      await setDoc(doc(cloudRef, String(cat.id)), {
        ...cat,
        userId: user.uid,
      });
    }

    if (updated) {
      updatedLocally.push(cat);
    }
  }

  // Step 4: Apply local updates after loop
  if (updatedLocally.length > 0) {
    const writeTx = localDB.transaction('categories', 'readwrite');
    const store = writeTx.store;
    for (const cat of updatedLocally) {
      store.put(cat);
    }
    await writeTx.done;
  }
};

// 🔁 Sync all data (Transactions + Categories)
export const syncAll = async () => {
  try {
    toast.info('🔄 Syncing with cloud...');

    await syncToFirestore();
    await syncCategoriesToFirestore();

    await syncFromFirestore();
    await syncCategoriesFromFirestore();

    toast.success('✅ Sync complete!');
  } catch (error) {
    console.error('Sync failed:', error);
    toast.error('❌ Sync failed. Please try again.');
  }
};
