import { getFirebaseClients } from '../firebase/config';

export const EMAIL_EVENT_TYPES = {
  WELCOME: 'welcome',
  REQUEST_CREATED: 'request_created',
  REQUEST_ACCEPTED: 'request_accepted',
  SESSION_SCHEDULED: 'session_scheduled',
  SESSION_UPDATED: 'session_updated',
  SESSION_COMPLETED: 'session_completed',
  CANCELLATION: 'cancellation',
};

export async function queueEmailEvent(eventType, payload) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return;
  }

  const { db, firestoreModule } = clients;
  const { addDoc, collection, serverTimestamp } = firestoreModule;

  await addDoc(collection(db, 'emailEvents'), {
    eventType,
    payload,
    status: 'queued',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
