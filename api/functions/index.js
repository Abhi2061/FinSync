/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Internal helper to log actions
const logAction = async (groupId, action, actorId, targetId = null, details = {}) => {
    try {
        await db.collection(`groups/${groupId}/logs`).add({
            action,
            actorId,
            targetId,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        logger.error("Failed to log action", e);
    }
};

/**
 * Send an invite to a user by email.
 * data: { email: string, groupId: string }
 */
exports.sendInvite = onCall(async (request) => {
    const { email, groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // 1. Verify group exists and caller is admin (or just a member? Plan says Admin checks if user exists. Let's allow any member to invite for now, or stick to admin? 
    // The roles table says "Admin" for most actions, but "Member" can create transactions. Usually inviting is member restricted or admin only.
    // Let's stick to Admin only for invites based on strict interpretation, OR allow members for better UX. 
    // Plan said: "Admin enters email". So Admin only.

    const groupRef = db.doc(`groups/${groupId}`);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
        throw new HttpsError("not-found", "Group not found.");
    }

    const groupData = groupSnap.data();
    if (groupData.admin !== callerUid) {
        throw new HttpsError("permission-denied", "Only admin can invite members.");
    }

    if (groupData.type === 'personal') {
        throw new HttpsError("failed-precondition", "Cannot invite members to personal profile.");
    }

    // 2. Find user by email
    let userIdToAdd;
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        userIdToAdd = userRecord.uid;
    } catch (error) {
        // If user doesn't exist, we can't invite them to this internal system yet (unless we handle external invites).
        // For now, return error or handle it. "If not: show prompt No user found"
        if (error.code === 'auth/user-not-found') {
            throw new HttpsError("not-found", "User with this email does not exist in FinSync.");
        }
        throw error;
    }

    // 3. Check if already a member
    if (groupData.members.includes(userIdToAdd)) {
        throw new HttpsError("already-exists", "User is already a member.");
    }

    // 4. Create Invite
    const inviterRecord = await admin.auth().getUser(callerUid);
    const inviterName = inviterRecord.displayName || inviterRecord.email;

    const inviteRef = await db.collection(`groups/${groupId}/invites`).add({
        email,
        userId: userIdToAdd,
        invitedBy: callerUid,
        inviterName: inviterName, // Store readable name
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        groupName: groupData.name // Store group name for display
    });

    // 5. Also add to user's 'pendingInvites' collection or something so they can query it easily? 
    // Or just query collectionGroup? Querying `groups/{gid}/invites` where userId == MyID is better.
    // Actually, to make it easy for the invited user to see it, we might want a top-level `invites` collection or duplicate it.
    // Let's stick to strict subcollection logic for now, but we need a way for user to find it.
    // "User sees pendingInvites in dashboard".
    // A collectionGroup query on `invites` where `userId` == auth.uid will work perfectly.

    await logAction(groupId, "invite_sent", callerUid, userIdToAdd, { email });

    return { success: true, inviteId: inviteRef.id };
});

/**
 * Accept an invite.
 * data: { inviteId: string, groupId: string }
 */
exports.acceptInvite = onCall(async (request) => {
    const { inviteId, groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    const inviteRef = db.doc(`groups/${groupId}/invites/${inviteId}`);
    const groupRef = db.doc(`groups/${groupId}`);

    return db.runTransaction(async (t) => {
        const inviteDoc = await t.get(inviteRef);
        const groupDoc = await t.get(groupRef);

        if (!inviteDoc.exists) throw new HttpsError("not-found", "Invite not found.");
        if (!groupDoc.exists) throw new HttpsError("not-found", "Group not found.");

        const inviteData = inviteDoc.data();
        if (inviteData.userId !== callerUid) {
            throw new HttpsError("permission-denied", "This invite is not for you.");
        }
        if (inviteData.status !== 'pending') {
            throw new HttpsError("failed-precondition", "Invite is no longer valid.");
        }

        // Add to members
        const currentMembers = groupDoc.data().members || [];
        if (!currentMembers.includes(callerUid)) {
            // Fetch user details to store
            const userRecord = await admin.auth().getUser(callerUid);
            t.update(groupRef, {
                members: admin.firestore.FieldValue.arrayUnion(callerUid),
                [`memberDetails.${callerUid}`]: {
                    displayName: userRecord.displayName || userRecord.email.split('@')[0],
                    email: userRecord.email
                }
            });
        }

        // Update invite status
        t.delete(inviteRef);
    }).then(() => {
        logAction(groupId, "invite_accepted", callerUid);
        return { success: true };
    });
});

/**
 * Decline an invite.
 * data: { inviteId: string, groupId: string }
 */
exports.declineInvite = onCall(async (request) => {
    const { inviteId, groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    const inviteRef = db.doc(`groups/${groupId}/invites/${inviteId}`);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) throw new HttpsError("not-found", "Invite not found.");

    if (inviteDoc.data().userId !== callerUid) {
        throw new HttpsError("permission-denied", "Not your invite.");
    }

    await inviteRef.delete();
    return { success: true };
});

/**
 * Remove a member from the group.
 * data: { memberId: string, groupId: string }
 */
exports.removeMember = onCall(async (request) => {
    const { memberId, groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    const groupRef = db.doc(`groups/${groupId}`);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) throw new HttpsError("not-found", "Group not found.");

    if (groupDoc.data().admin !== callerUid) {
        throw new HttpsError("permission-denied", "Only admin can remove members.");
    }

    if (memberId === callerUid) {
        throw new HttpsError("invalid-argument", "Cannot remove yourself. Use leaveGroup instead.");
    }

    await groupRef.update({
        members: admin.firestore.FieldValue.arrayRemove(memberId)
    });

    await logAction(groupId, "member_removed", callerUid, memberId);
    return { success: true };
});

/**
 * Leave a group.
 * data: { groupId: string }
 */
exports.leaveGroup = onCall(async (request) => {
    const { groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    const groupRef = db.doc(`groups/${groupId}`);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) throw new HttpsError("not-found", "Group not found.");

    // If admin tries to leave, they must transfer ownership first or delete group.
    // Simpler: Admin cannot leave, must delete group.
    if (groupDoc.data().admin === callerUid) {
        throw new HttpsError("failed-precondition", "Admin cannot leave the group. Delete the group instead.");
    }

    if (groupDoc.data().type === 'personal') {
        throw new HttpsError("failed-precondition", "Cannot leave personal profile.");
    }

    await groupRef.update({
        members: admin.firestore.FieldValue.arrayRemove(callerUid)
    });

    await logAction(groupId, "member_left", callerUid);
    return { success: true };
});

/**
 * Delete a group.
 * data: { groupId: string }
 */
exports.deleteGroup = onCall(async (request) => {
    const { groupId } = request.data;
    const callerUid = request.auth.uid;

    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    const groupRef = db.doc(`groups/${groupId}`);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) throw new HttpsError("not-found", "Group not found.");

    if (groupDoc.data().admin !== callerUid) {
        throw new HttpsError("permission-denied", "Only admin can delete the group.");
    }

    if (groupDoc.data().type === 'personal') {
        throw new HttpsError("failed-precondition", "Cannot delete personal profile.");
    }

    // Hard delete group doc.
    // Ideally we should delete subcollections (transactions, categories) recursively.
    // For now, deleting the group doc hides it from the UI.
    // A proper implementation would use `firebase-tools` to recursive delete.
    // Given the constraints and simplicity needed, we will just delete the document.
    // Data in subcollections will become orphaned (which is fine for MVP/NoSQL).

    await groupRef.delete();

    // Log action? Can't log to group if deleted.
    logger.log(`Group ${groupId} deleted by ${callerUid}`);
    return { success: true };
});

/**
 * Scheduled function to expire old invites (older than 7 days).
 * Run every 24 hours.
 */
exports.expireInvites = onSchedule("every 24 hours", async (event) => {
    const NOW = Date.now();
    const EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = admin.firestore.Timestamp.fromMillis(NOW - EXPIRATION_TIME);

    // Query all invites across all groups
    const snapshot = await db.collectionGroup('invites')
        .where('createdAt', '<', cutoff)
        .get();

    if (snapshot.empty) {
        logger.log("No expired invites found.");
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    logger.log(`Expired ${snapshot.size} invites.`);
});