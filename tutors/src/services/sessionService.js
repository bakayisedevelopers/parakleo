import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';
import { updateLiveTracking } from './liveTrackingRealtimeService';
import { updateUserRatingSummary } from './userService';

export function subscribeToTutorSessions(tutorId, callback, onError) {
  if (!tutorId) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const q = query(
    collection(db, 'sessions'),
    where('tutorId', '==', tutorId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Deliver current items immediately to the UI
      callback(items);

      // Self-heal: check if any non-terminal session belongs to a closed/canceled request
      const nonTerminalItems = items.filter(
        (it) => ['arrived', 'accepted', 'travelling', 'traveling', 'waiting_student', 'preparing_for_lesson'].includes(String(it.status || '').toLowerCase()) && it.requestId
      );

      if (nonTerminalItems.length > 0) {
        Promise.all(
          nonTerminalItems.map(async (item) => {
            try {
              const reqSnap = await getDoc(doc(db, 'classRequests', item.requestId));
              if (reqSnap.exists()) {
                const reqData = reqSnap.data() || {};
                const reqStatus = String(reqData.status || '').toLowerCase();
                const isTerminal = ['canceled', 'canceled_by_tutor', 'canceled_by_student', 'canceled_during', 'cancelled', 'completed', 'settled', 'expired', 'closed'].includes(reqStatus);
                if (isTerminal && reqStatus !== String(item.status || '').toLowerCase()) {
                  await setDoc(
                    doc(db, 'sessions', item.id),
                    {
                      status: reqStatus,
                      canceledBy: reqData.canceledBy || null,
                      canceledAt: reqData.canceledAt || Date.now(),
                      canceledReason: reqData.canceledReason || null,
                      updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                  ).catch(() => null);
                  item.status = reqStatus;
                  if (reqData.canceledBy) item.canceledBy = reqData.canceledBy;
                }
              }
            } catch (_) {}
          })
        ).then(() => {
          callback([...items]);
        }).catch(() => null);
      }
    },
    (error) => {
      console.error('subscribeToTutorSessions error:', error);
      onError?.(error);
    }
  );
}

export function subscribeToSessionById(sessionId, callback, onError) {
  if (!sessionId) {
    callback?.(null);
    return () => {};
  }

  const { db } = getFirebaseClients();
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snapshot) => callback?.(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (error) => {
      console.error('subscribeToSessionById error:', error);
      onError?.(error);
    }
  );
}

export async function findSessionIdByRequestAndTutor({ requestId, tutorId }) {
  if (!requestId || !tutorId) return null;
  const { db } = getFirebaseClients();

  const q = query(
    collection(db, 'sessions'),
    where('requestId', '==', requestId),
    where('tutorId', '==', tutorId)
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

export async function updateSession(sessionId, updates) {
  if (!sessionId) return;
  const { db } = getFirebaseClients();
  const ref = doc(db, 'sessions', sessionId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function startInPersonSession({
  sessionId,
  requestId,
  tutorId,
  studentId,
  pricingSnapshot,
  subject,
  topic,
}) {
  const { db } = getFirebaseClients();
  const effectiveId = sessionId || requestId;
  if (!effectiveId) return null;

  const now = Date.now();
  const sessionRef = doc(db, 'sessions', effectiveId);
  const existingSnap = await getDoc(sessionRef).catch(() => null);

  if (!existingSnap || !existingSnap.exists()) {
    await setDoc(
      sessionRef,
      {
        id: effectiveId,
        requestId: requestId || effectiveId,
        tutorId: tutorId || '',
        studentId: studentId || '',
        status: 'in_progress',
        mode: 'in_person',
        startedAt: now,
        billingStartedAt: now,
        createdAtMs: now,
        updatedAt: serverTimestamp(),
        subject: subject || 'Mathematics',
        topic: topic || '',
        pricingSnapshot: pricingSnapshot || null,
        durationMinutes: Number(pricingSnapshot?.durationMinutes || 30),
        ratings: { student: null, tutor: null },
        ratingStatus: { student: 'pending', tutor: 'pending' },
      },
      { merge: true }
    );
  } else {
    const existing = existingSnap.data() || {};
    await updateDoc(sessionRef, {
      status: 'in_progress',
      startedAt: existing.startedAt || existing.billingStartedAt || now,
      billingStartedAt: existing.billingStartedAt || existing.startedAt || now,
      updatedAt: serverTimestamp(),
    });
  }

  if (requestId) {
    const reqRef = doc(db, 'classRequests', requestId);
    await updateDoc(reqRef, {
      status: 'in_session',
      statusDetail: 'Lesson in progress.',
      startedAt: now,
      updatedAt: serverTimestamp(),
    }).catch(() => null);

    await updateLiveTracking(requestId, {
      status: 'in_session',
      startedAtMs: now,
      updatedAtMs: now,
    }).catch(() => null);
  }

  return effectiveId;
}

export async function finalizeSessionClosure(session, options = {}) {
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();
  const closureType = options.closureType || 'completed';

  const endpoint = getFunctionEndpoint('finalizeSessionBilling');
  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          closureType,
          canceledBy: options.canceledBy || null,
          canceledReason: options.canceledReason || '',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success !== false) {
        return payload?.session || null;
      }
    } catch (err) {
      console.warn('finalizeSessionBilling endpoint failed, using local update fallback:', err);
    }
  }

  // Local Firestore fallback
  const now = Date.now();
  const sessionRef = doc(db, 'sessions', session.id);
  await updateDoc(sessionRef, {
    status: closureType,
    endedAt: now,
    billingEndedAt: now,
    canceledBy: options.canceledBy || null,
    canceledReason: options.canceledReason || '',
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  if (session.requestId) {
    const reqRef = doc(db, 'classRequests', session.requestId);
    await updateDoc(reqRef, {
      status: closureType === 'completed' ? 'completed' : 'canceled',
      endedAt: now,
      updatedAt: serverTimestamp(),
    }).catch(() => null);

    await updateLiveTracking(session.requestId, {
      status: closureType === 'completed' ? 'completed' : 'canceled',
      closedAtMs: now,
      closedReason: options.canceledReason || '',
      updatedAtMs: now,
    }).catch(() => null);
  }

  return { ...session, status: closureType, endedAt: now };
}

export async function endSession(session) {
  return finalizeSessionClosure(session, { closureType: 'completed' });
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

  const sessionRef = doc(db, 'sessions', session.id);
  await updateDoc(sessionRef, {
    [`ratings.${role}`]: ratingEntry,
    [`ratingStatus.${role}`]: 'submitted',
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  if (session?.requestId) {
    const reqRef = doc(db, 'classRequests', session.requestId);
    await updateDoc(reqRef, {
      [`ratings.${role}`]: ratingEntry,
      [`ratingStatus.${role}`]: 'submitted',
      updatedAt: serverTimestamp(),
    }).catch(() => null);
  }

  if (role === 'student' && session?.tutorId) {
    await updateUserRatingSummary(session.tutorId, 'asTutor', ratingEntry.overall).catch(() => null);
  }

  if (role === 'tutor' && session?.studentId) {
    await updateUserRatingSummary(session.studentId, 'asStudent', ratingEntry.overall).catch(() => null);
  }
}

export async function startTutorTravel({ requestId, tutorId }) {
  if (!requestId) return;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('startTutorTravel');

  if (!idToken || !endpoint) {
    throw new Error('Unable to start travel while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, tutorId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to start travel right now.');
  }
  return payload;
}

export async function markTutorArrived({ requestId, sessionId, tutorId, distanceMeters = 0 }) {
  if (!requestId) return;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('markTutorArrived');

  if (!idToken || !endpoint) {
    throw new Error('Unable to mark arrival while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, sessionId, tutorId, distanceMeters }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to mark arrival right now.');
  }
  return payload;
}

export async function markPreparingForLesson({ requestId, sessionId, tutorId }) {
  if (!requestId) return;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('markPreparingForLesson');

  if (!idToken || !endpoint) {
    throw new Error('Unable to mark preparation while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, sessionId, tutorId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to mark preparation right now.');
  }
  return payload;
}

export async function startInPersonLesson({ requestId, sessionId }) {
  const effSessionId = sessionId || requestId;
  if (!effSessionId) return null;
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('startInPersonLesson');

  if (!idToken || !endpoint) {
    throw new Error('Unable to start lesson while offline. Please try again.');
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
    throw new Error(payload?.message || 'Unable to start lesson right now.');
  }
  return payload;
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
  canceledBy = 'tutor',
  reason = 'Canceled by user',
  distanceTravelledKm = 0,
  totalRouteKm = 10,
}) {
  const { auth } = getFirebaseClients();
  const effSessionId = sessionId || requestId || session?.id;
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
      sessionId: effSessionId,
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
