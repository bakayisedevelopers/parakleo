import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

export function subscribeToStudentRequests(studentId, callback, onError) {
  if (!studentId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const requestsQuery = query(
    collection(db, 'classRequests'),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}
