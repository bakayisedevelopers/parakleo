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
  const { auth, db } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('cancelInPersonLesson');
  const trimmedReason = String(reason || 'Canceled by tutor').trim();
  const effTutorId = tutorId || auth.currentUser?.uid;

  // Resilient local user active state cleanup
  if (effTutorId) {
    updateDoc(doc(db, 'users', effTutorId), {
      activeClassRequestId: null,
      activeSessionId: null,
      updatedAt: serverTimestamp(),
    }).catch(() => null);
  }

  if (!requestId && !sessionId) {
    return { success: true, alreadyTerminal: true };
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
      requestId: requestId || sessionId,
      sessionId: sessionId || requestId,
      canceledBy: 'tutor',
      reason: trimmedReason,
    }),
  });

  const result = await response.json().catch(() => ({}));

  // If already terminal or 409, treat as cleanly closed
  if (response.status === 409 || result?.alreadyTerminal) {
    return { success: true, alreadyTerminal: true, ...result };
  }

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to cancel request right now.');
  }

  return result;
}

export async function confirmCashCollectionService({ sessionId, requestId, collected }) {
  const { auth } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('confirmCashCollection');

  if (!token || !endpoint) {
    throw new Error('Unable to confirm cash collection while offline.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sessionId: sessionId || requestId,
      requestId: requestId || sessionId,
      collected: Boolean(collected),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to record cash collection.');
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
