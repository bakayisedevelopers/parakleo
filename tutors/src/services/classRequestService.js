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
    where('currentOfferTutorId', '==', tutorId),
    orderBy('updatedAt', 'desc')
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
    where('tutorId', '==', tutorId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((req) => ['accepted', 'in_session'].includes(req.status));
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

  const { auth, db } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken();
  const tutorLocation = await getCurrentLocationSnapshot().catch(() => null);

  try {
    const endpoint = getFunctionEndpoint('acceptClassRequest');
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
    if (response.ok && result?.success) {
      await updateLiveTracking(requestId, {
        tutorId,
        tutorName: tutorName || '',
        sessionId: result.sessionId || requestId,
        tutorLocation: tutorLocation || undefined,
        status: 'accepted',
        statusDetail: 'Tutor accepted and is preparing for class.',
        acceptedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }).catch(() => null);
      return { ...result, sessionId: result.sessionId || requestId };
    }
  } catch (err) {
    console.warn('acceptClassRequest endpoint fallback:', err?.message);
  }

  const reqRef = doc(db, 'classRequests', requestId);
  const tutorRef = doc(db, 'users', tutorId);
  const sessionRef = doc(db, 'sessions', requestId);
  const now = Date.now();

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('Class request not found.');
    }
    const currentData = reqSnap.data() || {};
    if (currentData.status !== 'offered' && currentData.status !== 'matching') {
      throw new Error('Class request is no longer available.');
    }

    transaction.update(reqRef, {
      status: 'accepted',
      statusDetail: 'Tutor accepted and is preparing for class.',
      tutorId,
      tutorName: tutorName || '',
      tutorEmail: tutorEmail || '',
      currentOfferTutorId: null,
      offerExpiresAt: null,
      sessionId: requestId,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(tutorRef, {
      activeClassRequestId: requestId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    transaction.set(sessionRef, {
      id: requestId,
      requestId,
      tutorId,
      tutorName: tutorName || '',
      studentId: currentData.studentId || '',
      studentName: currentData.studentName || '',
      mode: currentData.mode || 'in_person',
      subject: currentData.subject || 'Mathematics',
      topic: currentData.topic || '',
      grade: currentData.grade || '',
      curriculum: currentData.curriculum || '',
      status: 'accepted',
      statusDetail: 'Tutor accepted and is preparing for class.',
      meetingAddress: currentData.meetingAddress || currentData.studentAddress || currentData.locationAddress || '',
      studentLocation: currentData.studentLocation || currentData.location || null,
      pricingSnapshot: currentData.pricingSnapshot || null,
      durationMinutes: Number(currentData.durationMinutes || currentData.pricingSnapshot?.durationMinutes || 10),
      createdAtMs: now,
      acceptedAtMs: now,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  await updateLiveTracking(requestId, {
    tutorId,
    tutorName: tutorName || '',
    sessionId: requestId,
    tutorLocation: tutorLocation || undefined,
    status: 'accepted',
    statusDetail: 'Tutor accepted and is preparing for class.',
    acceptedAtMs: now,
    updatedAtMs: now,
  }).catch(() => null);

  return { success: true, requestId, sessionId: requestId };
}

export async function declineClassRequest({ requestId, tutorId }) {
  if (!requestId || !tutorId) return;

  const { auth, db } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken();

  try {
    const endpoint = getFunctionEndpoint('declineClassRequest');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId, tutorId }),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.success) {
      return result;
    }
  } catch (err) {
    console.warn('declineClassRequest endpoint fallback:', err?.message);
  }

  const reqRef = doc(db, 'classRequests', requestId);
  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) return;
    const currentData = reqSnap.data() || {};

    const nextQueue = Array.isArray(currentData.tutorQueue)
      ? currentData.tutorQueue.filter((id) => id !== tutorId)
      : [];
    const nextDeclinedTutorIds = Array.from(new Set([
      ...(Array.isArray(currentData.declinedTutorIds) ? currentData.declinedTutorIds : []),
      tutorId,
    ]));
    const nextExcludedTutorIds = Array.from(new Set([
      ...(Array.isArray(currentData.offerCycleExcludedTutorIds) ? currentData.offerCycleExcludedTutorIds : []),
      tutorId,
    ]));

    transaction.update(reqRef, {
      status: 'matching',
      statusDetail: 'Tutor declined. Matching next tutor.',
      currentOfferTutorId: null,
      offerExpiresAt: null,
      tutorQueue: nextQueue,
      declinedTutorIds: nextDeclinedTutorIds,
      offerCycleExcludedTutorIds: nextExcludedTutorIds,
      updatedAt: serverTimestamp(),
    });
  });

  return { success: true, requestId };
}

export async function cancelClassRequestAndSession({ requestId, sessionId, tutorId, reason }) {
  const { db } = getFirebaseClients();
  const canceledAt = Date.now();
  const trimmedReason = String(reason || 'Canceled by tutor').trim();

  // 1. Update classRequest if requestId exists
  if (requestId) {
    const reqRef = doc(db, 'classRequests', requestId);
    await updateDoc(reqRef, {
      status: 'canceled',
      statusDetail: trimmedReason,
      canceledAt,
      canceledBy: 'tutor',
      canceledReason: trimmedReason,
      currentOfferTutorId: null,
      offerExpiresAt: null,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.warn('cancel classRequest error:', err));

    // Update Realtime Database live tracking
    await updateLiveTracking(requestId, {
      status: 'canceled',
      closedReason: trimmedReason,
      closedAtMs: canceledAt,
      updatedAtMs: canceledAt,
    }).catch((err) => console.warn('cancel liveTracking error:', err));
  }

  // 2. Resolve sessionId if missing
  let targetSessionId = sessionId;
  if (!targetSessionId && requestId && tutorId) {
    targetSessionId = await findSessionIdByRequestAndTutor({ requestId, tutorId }).catch(() => null);
  }

  // 3. Update session if targetSessionId exists
  if (targetSessionId) {
    const sessionRef = doc(db, 'sessions', targetSessionId);
    await updateDoc(sessionRef, {
      status: 'canceled',
      statusDetail: trimmedReason,
      endedAt: canceledAt,
      canceledAt,
      canceledBy: 'tutor',
      canceledReason: trimmedReason,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.warn('cancel session error:', err));
  } else if (requestId) {
    const sessionsQuery = query(collection(db, 'sessions'), where('requestId', '==', requestId));
    const snap = await getDocs(sessionsQuery).catch(() => null);
    if (snap && !snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(d.ref, {
          status: 'canceled',
          statusDetail: trimmedReason,
          endedAt: canceledAt,
          canceledAt,
          canceledBy: 'tutor',
          canceledReason: trimmedReason,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit().catch((err) => console.warn('batch cancel sessions error:', err));
    }
  }

  // 4. Clear activeClassRequestId on tutor user doc
  if (tutorId) {
    const tutorRef = doc(db, 'users', tutorId);
    await updateDoc(tutorRef, {
      activeClassRequestId: null,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.warn('clear tutor activeClassRequestId error:', err));
  }

  return { success: true };
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

