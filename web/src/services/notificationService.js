import { getFirebaseClients } from '../firebase/config';

const MOCK_NOTIFICATIONS_KEY = 'claxi_mock_notifications';

function getMockNotifications() {
  return JSON.parse(localStorage.getItem(MOCK_NOTIFICATIONS_KEY) || '[]');
}

function setMockNotifications(notifications) {
  localStorage.setItem(MOCK_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new StorageEvent('storage'));
}

export async function createNotification(payload) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const next = [
      {
        id: crypto.randomUUID(),
        ...payload,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...getMockNotifications(),
    ];
    setMockNotifications(next);
    return;
  }

  const { db, firestoreModule } = clients;
  const { addDoc, collection, serverTimestamp } = firestoreModule;

  await addDoc(collection(db, 'notifications'), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToNotifications(userId, callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!userId) {
      callback([]);
      return;
    }

    if (!clients) {
      const emit = () => callback(getMockNotifications().filter((item) => item.userId === userId));
      emit();
      window.addEventListener('storage', emit);
      unsub = () => window.removeEventListener('storage', emit);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, orderBy, query, where } = firestoreModule;

    const queryRef = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    unsub = onSnapshot(queryRef, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  });

  return () => unsub?.();
}
