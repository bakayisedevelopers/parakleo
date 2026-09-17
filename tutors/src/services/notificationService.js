import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

export function subscribeToNotifications(userId, callback, onError) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(items);
    },
    (error) => {
      console.warn('subscribeToNotifications error:', error?.message);
      onError?.(error);
    }
  );
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return;
  const { db } = getFirebaseClients();
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map((docSnap) =>
    updateDoc(doc(db, 'notifications', docSnap.id), {
      read: true,
      readAt: serverTimestamp(),
    })
  );
  await Promise.all(updates);
}

export async function deleteNotification(notificationId) {
  if (!notificationId) return;
  const { db } = getFirebaseClients();
  await deleteDoc(doc(db, 'notifications', notificationId));
}
