const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * Triggered on new message creation to dispatch FCM push notifications
 * and update the parent chat thread metadata atomically.
 */
exports.onMessageCreated = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = message.chatId;

    // 1. Update parent chat's lastMessage & lastMessageTime
    await db.doc(`chats/${chatId}`).set({
      lastMessage: message.text || `[${message.type}]`,
      lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
      lastSenderId: message.senderId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Fetch chat participants to notify them
    const chatSnap = await db.doc(`chats/${chatId}`).get();
    if (!chatSnap.exists) return null;
    const chatData = chatSnap.data();
    const recipients = (chatData.participants || []).filter(uid => uid !== message.senderId);

    // 3. Create in-app notifications
    const batch = db.batch();
    for (const recipientId of recipients) {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        id: notifRef.id,
        userId: recipientId,
        senderId: message.senderId,
        senderName: message.senderName || 'DOST User',
        senderPhotoUrl: message.senderPhotoUrl || '',
        title: chatData.type === 'group' ? chatData.name : message.senderName,
        body: message.text || `Sent a ${message.type}`,
        type: 'message',
        chatId: chatId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return { success: true };
  });

/**
 * Clean up user references on account deletion
 */
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  await db.doc(`users/${uid}`).delete();
  const blockedQuery = await db.collection('blocked_users').where('userId', '==', uid).get();
  const batch = db.batch();
  blockedQuery.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
});
