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

// Return a list of group objects that include the current user as a member.
// Each returned object contains the Firestore document ID in `id` along with
// the rest of the stored group data.
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

// === Pull remote data for one group into the local IndexedDB ===
// This routine fetches all transactions and categories for `groupId`
// from Firestore and merges them with whatever is stored locally, using
// `lastModified` timestamps to decide which version wins.
const syncGroupFromFirestore = async (groupId) => {
  const localDB = await initDB();

  // 1. Sync transactions collection
  // fetch every remote transaction belonging to this group
  const txnRef = collection(db, 'groups', groupId, 'transactions');
  const txnSnap = await getDocs(txnRef);
  const txnTx = localDB.transaction('transactions', 'readwrite');
  const txnStore = txnTx.store;

  // Query the local IndexedDB store for transactions whose
  // `groupId` matches; we will compare these against the cloud set.
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
      // Handle ID type mismatch (number vs string):
      // Older local records might have numeric IDs while Firestore always
      // uses strings. When a record appears identical apart from the key type,
      // delete the old one before inserting the cloud version so we don't end
      // up with duplicates.

      if (localTxn && localTxn.id !== cloudTxn.id) {
        await txnStore.delete(localTxn.id);
      }
      await txnStore.put(cloudTxn);
    }
  }
  await txnTx.done; // Commit transactions

  // 2. Sync categories collection (the same merging logic as above)
  const catRef = collection(db, 'groups', groupId, 'categories');
  const catSnap = await getDocs(catRef);
  const catTx = localDB.transaction('categories', 'readwrite');
  const catStore = catTx.store;

  // Get local cats for this group
  const catGroupIdIndex = catStore.index('groupId');
  const localCats = await catGroupIdIndex.getAll(groupId);
  const localCatMap = new Map(localCats.map(c => [String(c.id), c])); // Normalize ID to string for lookup

  for (const docSnap of catSnap.docs) {
    // Notes on ID formats:
    // - Firestore generates string IDs for every document.
    // - The local IndexedDB used to auto‑increment numeric IDs.
    // To keep syncing reliably we treat both forms as strings and,
    // if necessary, delete the numeric entry when replacing it.

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

// === Push local changes upward to Firestore ===
// Walk every transaction and category stored locally and upload
// modifications to the corresponding group's subcollection.  Running
// this before the pull step ensures the remote side sees the latest edits.
export const syncToFirestore = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const localDB = await initDB();

  // --- handle transactions first ---
  // load every transaction from the local database so they can be grouped
  const tx = localDB.transaction('transactions', 'readonly');
  const localTransactions = await tx.store.getAll();

  // Rather than blindly overwriting remote documents, we compare
  // timestamps.  To minimize repeated reads we first bucket the local
  // list by `groupId` so we can fetch each cloud collection only once.

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
    // Fetching every document in the cloud collection costs one read per
    // item, but it allows accurate timestamp comparison.  A future
    // optimization might track dirty flags instead of pulling the whole set.

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

  // --- then handle categories ---
  // same pattern as transactions: read local records first
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

// === Top-level sync orchestration ===
// Calls push then pull so the user's edits propagate before we
// refresh with any group changes from the server.
export const syncAll = async () => {
  try {
    toast.info('🔄 Syncing...');
    const user = auth.currentUser;
    if (!user) return;

    // 1. Send any pending local changes up to Firestore
    await syncToFirestore();

    // 2. Fetch the list of groups the user belongs to and
    //    pull down any updates for each one
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
