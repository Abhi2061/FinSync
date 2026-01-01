import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { auth, db, functions } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, setDoc, serverTimestamp, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { syncAll } from '../utils/cloudSync';

const GroupContext = createContext();

export const useGroup = () => useContext(GroupContext);

export const GroupProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [currentGroup, setCurrentGroup] = useState(null);
    const [userGroups, setUserGroups] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [loading, setLoading] = useState(true);

    // Ref to prevent duplicate group creation (race condition fix)
    const isCreatingRef = useRef(false);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setCurrentGroup(null);
                setUserGroups([]);
                setPendingInvites([]);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Groups Listener
    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserGroups(groups);

            // Auto-select first group if none selected or if current one was removed
            setCurrentGroup(prev => {
                // 1. Try to restore from localStorage
                const lastGroupId = localStorage.getItem('lastGroupId');
                if (lastGroupId) {
                    const lastGroup = groups.find(g => g.id === lastGroupId);
                    if (lastGroup) return lastGroup;
                }

                // 2. Fallback logic
                if (!prev && groups.length > 0) return groups[0];
                if (prev && !groups.find(g => g.id === prev.id)) return groups.length > 0 ? groups[0] : null;
                return prev;
            });

            setLoading(false);
        }, (error) => {
            console.error("Error fetching groups:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Auto-create Personal Profile if missing
    useEffect(() => {
        // Validation: wait for auth and initial data load
        if (!currentUser || loading) return;

        // Check if Personal group exists
        const hasPersonal = userGroups.some(g => g.type === 'personal' && g.admin === currentUser.uid);

        // Create only if missing AND not currently creating
        if (!hasPersonal && !isCreatingRef.current) {
            console.log("Creating default personal profile...");
            isCreatingRef.current = true;

            // Use deterministic ID to prevent duplicates if logic re-runs 
            const personalGroupId = `personal_${currentUser.uid}`;

            createGroup("Personal Ledger", "personal", personalGroupId).finally(() => {
                setTimeout(() => {
                    isCreatingRef.current = false;
                }, 3000);
            });
        }
    }, [currentUser, userGroups, loading]);

    // Pending Invites Listener
    useEffect(() => {
        if (!currentUser) return;

        try {
            const q = query(collectionGroup(db, 'invites'), where('userId', '==', currentUser.uid));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const invites = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    groupId: doc.ref.parent.parent.id // Access grandparent to get groupId
                }));
                setPendingInvites(invites);
            }, (error) => {
                console.error("Error fetching invites (may require index):", error);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Error setting up invite listener", e);
        }
    }, [currentUser]);

    const createGroup = async (name, type = 'shared', customId = null) => {
        if (!currentUser) return;
        try {
            const groupData = {
                name,
                type,
                admin: currentUser.uid,
                members: [currentUser.uid],
                memberDetails: {
                    [currentUser.uid]: {
                        displayName: currentUser.displayName || 'Admin',
                        email: currentUser.email
                    }
                },
                createdAt: serverTimestamp()
            };

            let groupId = customId;

            if (customId) {
                // Deterministic ID (Personal Groups) - Use setDoc with merge
                await setDoc(doc(db, 'groups', customId), groupData, { merge: true });
            } else {
                // Random ID (Shared Groups) - Use addDoc
                const docRef = await addDoc(collection(db, 'groups'), groupData);
                groupId = docRef.id;
            }

            toast.success(`Group "${name}" ${customId ? 'ready' : 'created'}!`);

            // Auto switch
            setCurrentGroup({
                id: groupId,
                ...groupData
            });
        } catch (error) {
            console.error("Error creating group:", error);
            toast.error("Failed to create group.");
            throw error; // Re-throw to handle in caller
        }
    };

    const switchGroup = (groupId) => {
        const group = userGroups.find(g => g.id === groupId);
        if (group) {
            setCurrentGroup(group);
            localStorage.setItem('lastGroupId', groupId);
        }
    };

    const sendInvite = async (email) => {
        if (!currentGroup) return;
        const fn = httpsCallable(functions, 'sendInvite');
        try {
            await fn({ email, groupId: currentGroup.id });
            toast.success(`Invite sent to ${email}`);
        } catch (error) {
            console.error("Invite failed:", error);
            toast.error(error.message || "Failed to send invite");
        }
    };

    const acceptInvite = async (inviteId, groupId) => {
        const fn = httpsCallable(functions, 'acceptInvite');
        try {
            await fn({ inviteId, groupId });
            toast.success("Invite accepted!");
        } catch (error) {
            console.error("Accept failed:", error);
            toast.error("Failed to accept invite");
        }
    };

    const removeMember = async (memberId) => {
        if (!currentGroup) return;
        const fn = httpsCallable(functions, 'removeMember');
        try {
            await fn({ memberId, groupId: currentGroup.id });
            toast.success("Member removed");
        } catch (error) {
            console.error("Remove failed:", error);
            toast.error(error.message || "Failed to remove member");
        }
    };

    const leaveGroup = async (groupId) => {
        const fn = httpsCallable(functions, 'leaveGroup');
        try {
            await fn({ groupId });
            toast.success("Left group successfully");
            setCurrentGroup(null);
        } catch (error) {
            console.error("Leave failed:", error);
            toast.error(error.message || "Failed to leave group");
        }
    };

    const deleteGroup = async (groupId) => {
        const fn = httpsCallable(functions, 'deleteGroup');
        try {
            await fn({ groupId });
            toast.success("Group deleted");
            setCurrentGroup(null);
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error(error.message || "Failed to delete group");
        }
    };

    const values = {
        currentUser,
        currentGroup,
        userGroups,
        pendingInvites,
        createGroup,
        switchGroup,
        sendInvite,
        acceptInvite,
        removeMember,
        leaveGroup,
        deleteGroup,
        loading
    };

    return (
        <GroupContext.Provider value={values}>
            {children}
        </GroupContext.Provider>
    );
};
