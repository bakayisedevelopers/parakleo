import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

export function subscribeToStudentSessions(studentId, callback, onError) {
  if (!studentId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}
