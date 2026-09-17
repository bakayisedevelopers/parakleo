import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

export async function listTutorWeeklyPayouts(tutorId) {
  if (!tutorId) return [];

  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'tutorWeeklyPayouts'),
    where('tutorId', '==', tutorId),
    orderBy('weekKey', 'desc')
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (err) {
    console.warn('listTutorWeeklyPayouts query error:', err?.message);
    return [];
  }
}
