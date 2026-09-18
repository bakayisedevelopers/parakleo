import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';
import { updateUserRatingSummary } from './userService';
import { updateLiveTracking } from './liveTrackingRealtimeService';

const FINALIZE_SESSION_BILLING_ENDPOINT = 'finalizeSessionBilling';
const DEFAULT_RATING_STATUS = {
  student: 'pending',
  tutor: 'pending',
};

const SESSION_STATUS = {
  WAITING_STUDENT: 'waiting_student',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  CANCELED_DURING: 'canceled_during',
};

function mergeRatingStatus(existing, role, nextValue) {
  return {
    ...DEFAULT_RATING_STATUS,
    ...(existing || {}),
    [role]: nextValue,
  };
}

function deriveRequestStatusFromSession(sessionStatus) {
  if ([SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(sessionStatus)) {
    return 'in_session';
  }

  if (sessionStatus === SESSION_STATUS.COMPLETED) {
    return 'completed';
  }

  if (sessionStatus === SESSION_STATUS.CANCELED) {
    return 'canceled';
  }

  if (sessionStatus === SESSION_STATUS.CANCELED_DURING) {
    return 'canceled_during';
  }

  return null;
}

function getRequestStatusPatch(nextStatus, updates = {}) {
  const requestStatus = deriveRequestStatusFromSession(nextStatus);
  if (!requestStatus) {
    return null;
  }

  const patch = {
    status: requestStatus,
    updatedAt: serverTimestamp(),
  };

  if (nextStatus === SESSION_STATUS.IN_PROGRESS) {
    patch.startedAt = updates.studentJoinedAt || Date.now();
    patch.statusDetail = 'Student joined. Session is in progress.';
  }

  if (nextStatus === SESSION_STATUS.COMPLETED) {
    patch.endedAt = updates.endedAt || Date.now();
    patch.statusDetail = 'Session ended. Billing completed.';
  }

  if (nextStatus === SESSION_STATUS.CANCELED || nextStatus === SESSION_STATUS.CANCELED_DURING) {
    patch.endedAt = updates.endedAt || Date.now();
    patch.statusDetail = 'Session canceled.';
  }

  return patch;
}

export function subscribeToStudentSessions(studentId, callback, onError) {
  if (!studentId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('studentId', '==', studentId),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (err) => {
      if (err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('index')) {
        const fallbackQuery = query(collection(db, 'sessions'), where('studentId', '==', studentId));
        return onSnapshot(
          fallbackQuery,
          (snapshot) => {
            const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            items.sort((a, b) => {
              const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
              const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
              return bTime - aTime;
            });
            callback(items);
          },
          onError,
        );
      }
      if (typeof onError === 'function') onError(err);
    },
  );
}

export function subscribeToSessionById(sessionId, callback, onError) {
  if (!sessionId) {
    callback(null);
    return () => {};
  }

  const { db } = getFirebaseClients();
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export async function updateSession(sessionId, updates = {}) {
  const { db } = getFirebaseClients();
  const sessionRef = doc(db, 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw new Error('Session not found.');
  }

  const existing = sessionSnap.data() || {};
  const effectiveRequestId = updates.requestId || existing.requestId || '';
  const batch = writeBatch(db);

  batch.update(sessionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  if (updates.status && effectiveRequestId) {
    const requestPatch = getRequestStatusPatch(updates.status, updates);
    if (requestPatch) {
      batch.update(doc(db, 'classRequests', effectiveRequestId), requestPatch);
    }
  }

  await batch.commit();

  const nextSnap = await getDoc(sessionRef);
  return nextSnap.exists() ? { id: nextSnap.id, ...nextSnap.data() } : null;
}

export async function joinSessionAsStudent(session, selectedCardId = '', selectedCardLast4 = '') {
  if (!session?.id) {
    throw new Error('Session not found.');
  }

  return updateSession(session.id, {
    status: SESSION_STATUS.IN_PROGRESS,
    requestId: session.requestId || '',
    studentJoinedAt: Date.now(),
    selectedCardId: selectedCardId || session.selectedCardId || '',
    selectedCardLast4: selectedCardLast4 || session.selectedCardLast4 || '',
  });
}

export async function finalizeSessionClosure(session, options = {}) {
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error('You must be signed in to finalize this session.');
  }

  const response = await fetch(getFunctionEndpoint(FINALIZE_SESSION_BILLING_ENDPOINT), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: session.id,
      closureType: options.closureType || SESSION_STATUS.COMPLETED,
      canceledBy: options.canceledBy || null,
      canceledReason: options.canceledReason || '',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to finalize session billing.');
  }

  return payload?.session || null;
}

export async function endSession(session) {
  return finalizeSessionClosure(session, { closureType: SESSION_STATUS.COMPLETED });
}

export async function submitSessionRating(session, role, payload) {
  const { db } = getFirebaseClients();
  const submittedAt = Date.now();
  const ratingEntry = {
    overall: Number(payload?.overall || 0),
    comment: payload?.comment || '',
    tags: Array.isArray(payload?.tags) ? payload.tags : [],
    submittedAt,
  };
  const ratingStatus = mergeRatingStatus(session?.ratingStatus, role, 'submitted');
  const batch = writeBatch(db);

  batch.update(doc(db, 'sessions', session.id), {
    ratings: {
      ...(session?.ratings || {}),
      [role]: ratingEntry,
    },
    ratingStatus,
    updatedAt: serverTimestamp(),
  });

  if (session?.requestId) {
    batch.update(doc(db, 'classRequests', session.requestId), {
      [`ratings.${role}`]: ratingEntry,
      [`ratingStatus.${role}`]: 'submitted',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  if (role === 'student' && session?.tutorId) {
    await updateUserRatingSummary(session.tutorId, 'asTutor', ratingEntry.overall).catch(() => null);
  }

  if (role === 'tutor' && session?.studentId) {
    await updateUserRatingSummary(session.studentId, 'asStudent', ratingEntry.overall).catch(() => null);
  }
}

export async function requestEndLesson({ requestId, sessionId }) {
  const effSessionId = sessionId || requestId;
  if (!effSessionId) return;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('requestEndInPersonLesson');

  if (!idToken || !endpoint) {
    throw new Error('Unable to request lesson end while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, sessionId: effSessionId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to request lesson end.');
  }
  return payload;
}

export async function confirmEndLesson({ requestId, sessionId, session }) {
  const effSessionId = sessionId || requestId || session?.id;
  if (!effSessionId) return;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('confirmEndInPersonLesson');

  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, sessionId: effSessionId }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.success) return payload;
      }
    } catch (err) {
      throw new Error(err?.message || 'Unable to finalize lesson completion.');
    }
  }

  throw new Error('Unable to finalize lesson while offline. Please try again.');
}

export async function toggleSessionPause({ sessionId, requestId, isPaused, pausedIntervals = [], currentTotalSeconds = 0 }) {
  const effSessionId = sessionId || requestId;
  if (!effSessionId) return;
  const { db } = getFirebaseClients();
  const sRef = doc(db, 'sessions', effSessionId);
  await updateDoc(sRef, {
    isPaused: Boolean(isPaused),
    pausedIntervals,
    totalPausedSeconds: Number(currentTotalSeconds || 0),
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  if (requestId) {
    await updateLiveTracking(requestId, {
      isPaused: Boolean(isPaused),
      updatedAtMs: Date.now(),
    }).catch(() => null);
  }
}

export function computeLocalCancellationQuote({
  status,
  canceledBy = 'student',
  distanceTravelledKm = 0,
  totalRouteKm = 10,
  estimatedAmount = 100,
  elapsedMinutes = 0,
  agreedRatePerMinute = 3.0,
}) {
  if (canceledBy === 'tutor') {
    return {
      cancellationCharge: 0,
      tutorPayout: 0,
      breakdown: { bookingFee: 0, travelFee: 0, lessonFee: 0 },
      reason: 'Tutor cancellation: R0 charge to student, R0 payout to tutor.',
    };
  }
  const normStatus = String(status || '').toLowerCase();
  if (['pending', 'matching', 'offered', 'accepted'].includes(normStatus)) {
    return {
      cancellationCharge: 0,
      tutorPayout: 0,
      breakdown: { bookingFee: 0, travelFee: 0, lessonFee: 0 },
      reason: 'Canceled before tutor travel started: no fee.',
    };
  }
  let bookingFee = Math.max(100, Math.min(200, Number(estimatedAmount) * 0.01));
  bookingFee = Number(bookingFee.toFixed(2));
  if (normStatus === 'travelling') {
    const travelRatio = totalRouteKm > 0 ? Math.min(1, Math.max(0, distanceTravelledKm / totalRouteKm)) : 0.5;
    const fullTravelFee = 40;
    const partialTravelFee = Number((fullTravelFee * travelRatio).toFixed(2));
    const totalCharge = Number((bookingFee + partialTravelFee).toFixed(2));
    return {
      cancellationCharge: totalCharge,
      tutorPayout: partialTravelFee,
      breakdown: { bookingFee, travelFee: partialTravelFee, lessonFee: 0 },
      reason: 'Canceled while tutor is travelling.',
    };
  }
  if (['arrived', 'waiting_student', 'preparing_for_lesson'].includes(normStatus)) {
    const fullTravelFee = 40;
    const totalCharge = Number((bookingFee + fullTravelFee).toFixed(2));
    return {
      cancellationCharge: totalCharge,
      tutorPayout: fullTravelFee,
      breakdown: { bookingFee, travelFee: fullTravelFee, lessonFee: 0 },
      reason: 'Canceled after tutor arrived.',
    };
  }
  if (['in_session', 'in_progress', 'ending_requested'].includes(normStatus)) {
    const fullTravelFee = 40;
    const lessonFee = Number((elapsedMinutes * agreedRatePerMinute).toFixed(2));
    const totalCharge = Number((bookingFee + fullTravelFee + lessonFee).toFixed(2));
    return {
      cancellationCharge: totalCharge,
      tutorPayout: Number((fullTravelFee + lessonFee).toFixed(2)),
      breakdown: { bookingFee, travelFee: fullTravelFee, lessonFee },
      reason: 'Canceled after lesson started.',
    };
  }
  return {
    cancellationCharge: 0,
    tutorPayout: 0,
    breakdown: { bookingFee: 0, travelFee: 0, lessonFee: 0 },
    reason: 'Standard cancellation.',
  };
}

export async function getCancellationQuote({
  requestId,
  sessionId,
  canceledBy = 'student',
  distanceTravelledKm = 0,
  totalRouteKm = 10,
  estimatedAmount = 100,
  elapsedMinutes = 0,
  agreedRatePerMinute = 3.0,
  status = 'accepted',
}) {
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('getCancellationQuote');

  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          sessionId,
          canceledBy,
          distanceTravelledKm,
          totalRouteKm,
        }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.quote) return payload.quote;
      }
    } catch (err) {
      console.warn('getCancellationQuote endpoint error, using local computation:', err);
    }
  }

  return computeLocalCancellationQuote({
    status,
    canceledBy,
    distanceTravelledKm,
    totalRouteKm,
    estimatedAmount,
    elapsedMinutes,
    agreedRatePerMinute,
  });
}

export async function cancelInPersonSession({
  requestId,
  sessionId,
  session,
  canceledBy = 'student',
  reason = 'Canceled by user',
  distanceTravelledKm = 0,
  totalRouteKm = 10,
}) {
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('cancelInPersonLesson');

  if (!idToken || !endpoint) {
    throw new Error('Unable to cancel while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestId,
      sessionId: sessionId || requestId || session?.id,
      canceledBy,
      reason,
      distanceTravelledKm,
      totalRouteKm,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to cancel right now.');
  }
  return payload;
}

export async function verifyMeetingPin({ requestId, sessionId, enteredPin }) {
  if (!requestId) throw new Error('Missing requestId');
  const normalizedPin = String(enteredPin || '').trim();
  if (!normalizedPin) throw new Error('Please enter the 4-digit PIN');

  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('verifyInPersonMeetingPin');

  if (!idToken || !endpoint) {
    throw new Error('Unable to verify PIN while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, sessionId, enteredPin: normalizedPin }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok && data.success) {
    return data;
  }
  const error = new Error(data.message || 'Invalid meeting PIN');
  error.code = data.code || 'PIN_MISMATCH';
  error.attemptsRemaining = data.attemptsRemaining;
  throw error;
}
