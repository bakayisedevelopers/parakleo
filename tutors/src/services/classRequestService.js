import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';
import { updateLiveTracking } from './liveTrackingRealtimeService';
import { getCurrentLocationSnapshot } from './locationService';
import { findSessionIdByRequestAndTutor } from './sessionService';

export function subscribeToTutorAvailableRequests(tutorId, callback, onError) {
  if (!tutorId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'classRequests'),
    where('status', '==', 'offered'),
    where('currentOfferTutorId', '==', tutorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || (typeof a.updatedAt === 'number' ? a.updatedAt : 0);
          const bTime = b.updatedAt?.toMillis?.() || (typeof b.updatedAt === 'number' ? b.updatedAt : 0);
          return bTime - aTime;
        });
      callback(items);
    },
    (error) => {
      console.error('subscribeToTutorAvailableRequests error:', error);
      onError?.(error);
    }
  );
}

export function subscribeToTutorAcceptedRequests(tutorId, callback, onError) {
  if (!tutorId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'classRequests'),
    where('tutorId', '==', tutorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((req) => {
          const norm = String(req?.status || '').toLowerCase();
          return !['canceled', 'canceled_during', 'canceled_by_tutor', 'canceled_by_student', 'cancelled', 'expired', 'closed', 'completed'].includes(norm);
        })
        .sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || (typeof a.updatedAt === 'number' ? a.updatedAt : 0);
          const bTime = b.updatedAt?.toMillis?.() || (typeof b.updatedAt === 'number' ? b.updatedAt : 0);
          return bTime - aTime;
        });
      callback(items);
    },
    (error) => {
      console.error('subscribeToTutorAcceptedRequests error:', error);
      onError?.(error);
    }
  );
}

export async function acceptClassRequest({ requestId, tutorId, tutorName, tutorEmail }) {
  if (!requestId || !tutorId) {
    throw new Error('Request ID and Tutor ID are required.');
  }

  const { auth } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken();
  const tutorLocation = await getCurrentLocationSnapshot().catch(() => null);
  const endpoint = getFunctionEndpoint('acceptClassRequest');
  if (!token || !endpoint) {
    throw new Error('Unable to accept request while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requestId,
      tutorId,
      tutorName,
      tutorEmail,
      tutorLocation: tutorLocation || undefined,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to accept request right now.');
  }
  await updateLiveTracking(requestId, {
    tutorLocation: tutorLocation || undefined,
    updatedAtMs: Date.now(),
  }).catch(() => null);
  return { ...result, sessionId: result.sessionId || requestId };
}

export async function declineClassRequest({ requestId, tutorId }) {
  if (!requestId || !tutorId) return;

  const { auth } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken();
  const endpoint = getFunctionEndpoint('declineClassRequest');
  if (!token || !endpoint) {
    throw new Error('Unable to decline request while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId, tutorId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to decline request right now.');
  }
  return result;
}

export async function cancelClassRequestAndSession({ requestId, sessionId, tutorId, reason }) {
  const { auth } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('cancelInPersonLesson');
  const trimmedReason = String(reason || 'Canceled by tutor').trim();
  if (!requestId) {
    throw new Error('Missing request ID.');
  }
  if (!token || !endpoint) {
    throw new Error('Unable to cancel while offline. Please try again.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requestId,
      sessionId: sessionId || requestId,
      canceledBy: 'tutor',
      reason: trimmedReason,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to cancel request right now.');
  }
  return result;
}

export function subscribeToRequestById(requestId, callback, onError) {
  if (!requestId) {
    callback?.(null);
    return () => {};
  }

  const { db } = getFirebaseClients();
  return onSnapshot(
    doc(db, 'classRequests', requestId),
    (snapshot) => callback?.(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (err) => {
      console.warn('subscribeToRequestById error:', err);
      onError?.(err);
    }
  );
}
