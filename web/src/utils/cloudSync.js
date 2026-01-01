import { db, auth } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { initDB } from './db';
import { toast } from 'react-toastify';

const now = () => new Date().toISOString();

const withDefaults = (item, groupId) => ({
  ...item,
  lastModified: item.lastModified || now(),
  deleted: item.deleted ?? false,
  groupId: groupId // Ensure groupId is attached
});

// Helper: Get all groups user is part of
export const getUserGroups = async () => {
  const user = auth.currentUser;
  if (!user) return [];

  // Query groups where 'members' array contains user.uid
  const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// 🔁 Pull from Firestore for a specific Group
const syncGroupFromFirestore = async (groupId) => {
  const localDB = await initDB();

  // 1. Transactions
  const txnRef = collection(db, 'groups', groupId, 'transactions');
  const txnSnap = await getDocs(txnRef);
  const txnTx = localDB.transaction('transactions', 'readwrite');
  const txnStore = txnTx.store;

  // Get local txns for this group only
  const groupIdIndex = txnStore.index('groupId');
  const localTxns = await groupIdIndex.getAll(groupId);
  const localMap = new Map(localTxns.map(txn => [String(txn.id), txn]));

  for (const docSnap of txnSnap.docs) {
    const cloudTxn = withDefaults({ ...docSnap.data(), id: docSnap.id }, groupId);
    // Note: cloudTxn.id is string, local might use same ID.

    const localTxn = localMap.get(cloudTxn.id);
    const localTime = new Date(localTxn?.lastModified || 0);
    const cloudTime = new Date(cloudTxn.lastModified);

    if (!localTxn || cloudTime > localTime) {
      // Fix for ID type mismatch (Int vs String):
      // If we found a local match (by value) but the keys are different (types),
      // we must delete the old local key (Int) before inserting the new cloud key (String).
      if (localTxn && localTxn.id !== cloudTxn.id) {
        await txnStore.delete(localTxn.id);
      }
      await txnStore.put(cloudTxn);
    }
  }
  await txnTx.done; // Commit transactions

  // 2. Categories
  const catRef = collection(db, 'groups', groupId, 'categories');
  const catSnap = await getDocs(catRef);
  const catTx = localDB.transaction('categories', 'readwrite');
  const catStore = catTx.store;

  // Get local cats for this group
  const catGroupIdIndex = catStore.index('groupId');
  const localCats = await catGroupIdIndex.getAll(groupId);
  const localCatMap = new Map(localCats.map(c => [String(c.id), c])); // Normalize ID to string for lookup

  for (const docSnap of catSnap.docs) {
    // Firestore IDs are strings, Local IDs might be numbers if auto-increment?
    // In existing code, cat id was 'parseInt(doc.id)'.
    // If we switch to UUIDs for categories (better for sync), we should use string IDs.
    // For compatibility with old code, let's try to keep ID consistent.
    // If we generate IDs with UUID, they are strings.
    const cloudCat = withDefaults({ ...docSnap.data(), id: docSnap.id }, groupId);

    const localCat = localCatMap.get(cloudCat.id);
    const localTime = new Date(localCat?.lastModified || 0);
    const cloudTime = new Date(cloudCat.lastModified || 0);

    if (!localCat || cloudTime > localTime) {
      // Fix for ID type mismatch: Delete old Int ID if replacing with String ID
      if (localCat && localCat.id !== cloudCat.id) {
        await catStore.delete(localCat.id);
      }
      await catStore.put(cloudCat);
    }
  }
  await catTx.done;
};

// 🔁 Push to Firestore for a specific Group
// We can actually just push ALL local data to their respective groups.
export const syncToFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const localDB = await initDB();

  // TRANSACTIONS
  const tx = localDB.transaction('transactions', 'readonly');
  const localTransactions = await tx.store.getAll();

  // We need to fetch cloud state for comparison to avoid overwriting newer changes?
  // Optimization: Group local txns by groupId.
  const txnsByGroup = localTransactions.reduce((acc, txn) => {
    if (txn.groupId) {
      acc[txn.groupId] = acc[txn.groupId] || [];
      acc[txn.groupId].push(txn);
    }
    return acc;
  }, {});

  for (const [groupId, txns] of Object.entries(txnsByGroup)) {
    if (!groupId || groupId === 'undefined') continue; // Skip invalid groups
    const cloudRef = collection(db, 'groups', groupId, 'transactions');
    // This is expensive (N reads). Better to modify 'lastModified' check logic or Assume we only push if we edited?
    // CloudSync usually relies on "If I have changes".
    // Let's do the "Get All Cloud" approach per group for safety, like before.
    const cloudSnap = await getDocs(cloudRef);
    const cloudMap = new Map(cloudSnap.docs.map(d => [d.id, d.data()]));

    for (const txn of txns) {
      const cloudTxn = cloudMap.get(String(txn.id));
      const localTime = new Date(txn.lastModified);
      const cloudTime = new Date(cloudTxn?.lastModified || 0);

      if (!cloudTxn || localTime > cloudTime) {
        await setDoc(doc(cloudRef, String(txn.id)), {
          ...txn,
          createdBy: txn.createdBy || user.uid, // ensure creator
        });
      }
    }
  }

  // CATEGORIES
  const catTx = localDB.transaction('categories', 'readonly');
  const localCategories = await catTx.store.getAll();

  const catsByGroup = localCategories.reduce((acc, cat) => {
    if (cat.groupId) {
      acc[cat.groupId] = acc[cat.groupId] || [];
      acc[cat.groupId].push(cat);
    }
    return acc;
  }, {});

  for (const [groupId, cats] of Object.entries(catsByGroup)) {
    if (!groupId || groupId === 'undefined') continue; // Skip invalid groups
    const cloudRef = collection(db, 'groups', groupId, 'categories');
    const cloudSnap = await getDocs(cloudRef);
    const cloudMap = new Map(cloudSnap.docs.map(d => [d.id, d.data()]));

    for (const cat of cats) {
      const cloudCat = cloudMap.get(String(cat.id));
      const localTime = new Date(cat.lastModified);
      const cloudTime = new Date(cloudCat?.lastModified || 0);

      if (!cloudCat || localTime > cloudTime) {
        await setDoc(doc(cloudRef, String(cat.id)), {
          ...cat,
          createdBy: cat.createdBy || user.uid
        });
      }
    }
  }
};

// 🔁 Main Sync Function
export const syncAll = async () => {
  try {
    toast.info('🔄 Syncing...');
    const user = auth.currentUser;
    if (!user) return;

    // 1. Push Local Changes to their groups
    await syncToFirestore();

    // 2. Pull Remote Changes from MY groups
    const myGroups = await getUserGroups();

    for (const group of myGroups) {
      await syncGroupFromFirestore(group.id);
    }

    toast.success('✅ Sync complete!');
  } catch (error) {
    console.error('Sync failed:', error);
    toast.error('❌ Sync failed.');
  }
};
