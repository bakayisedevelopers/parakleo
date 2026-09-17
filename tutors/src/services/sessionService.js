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
      callback(items);
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
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('startTutorTravel');

  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, tutorId }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.success) return payload;
      }
    } catch (err) {
      console.warn('startTutorTravel endpoint failed, falling back to direct write:', err);
    }
  }

  // Fallback direct write
  const now = Date.now();
  const reqRef = doc(db, 'classRequests', requestId);
  await updateDoc(reqRef, {
    status: 'travelling',
    statusDetail: 'Tutor has started travelling to your location.',
    travelStartedAt: now,
    startedTravellingAt: now,
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  await updateLiveTracking(requestId, {
    status: 'travelling',
    travelStartedAtMs: now,
    startedTravellingAtMs: now,
    updatedAtMs: now,
  }).catch(() => null);

  return { success: true, status: 'travelling', travelStartedAt: now, startedTravellingAt: now };
}

export async function markTutorArrived({ requestId, sessionId, tutorId, distanceMeters = 0 }) {
  if (!requestId) return;
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('markTutorArrived');

  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, sessionId, tutorId, distanceMeters }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.success) return payload;
      }
    } catch (err) {
      console.warn('markTutorArrived endpoint failed, falling back to direct write:', err);
    }
  }

  // Fallback direct write
  const now = Date.now();
  const gracePeriodMs = 5 * 60 * 1000;
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const pinExpiresAt = now + (30 * 60 * 1000);
  const reqRef = doc(db, 'classRequests', requestId);
  await updateDoc(reqRef, {
    status: 'arrived',
    statusDetail: 'Tutor has arrived at the student location.',
    arrivedAt: now,
    arrivalGraceStartedAt: now,
    arrivalGraceEndsAt: now + gracePeriodMs,
    verificationPin: pin,
    verificationPinGeneratedAt: now,
    verificationPinExpiresAt: pinExpiresAt,
    verificationPinAttempts: 0,
    maxVerificationPinAttempts: 3,
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  const effSessionId = sessionId || requestId;
  if (effSessionId) {
    const sRef = doc(db, 'sessions', effSessionId);
    await updateDoc(sRef, {
      status: 'arrived',
      arrivedAt: now,
      arrivalGraceStartedAt: now,
      arrivalGraceEndsAt: now + gracePeriodMs,
      verificationPin: pin,
      verificationPinGeneratedAt: now,
      verificationPinExpiresAt: pinExpiresAt,
      verificationPinAttempts: 0,
      maxVerificationPinAttempts: 3,
      updatedAt: serverTimestamp(),
    }).catch(() => null);
  }

  await updateLiveTracking(requestId, {
    status: 'arrived',
    arrivedAtMs: now,
    arrivalGraceStartedAtMs: now,
    arrivalGraceEndsAt: now + gracePeriodMs,
    arrivalGraceEndsAtMs: now + gracePeriodMs,
    verificationPin: pin,
    updatedAtMs: now,
  }).catch(() => null);

  return {
    success: true,
    status: 'arrived',
    arrivedAt: now,
    arrivalGraceEndsAt: now + gracePeriodMs,
    verificationPin: pin,
  };
}

export async function markPreparingForLesson({ requestId, sessionId, tutorId }) {
  if (!requestId) return;
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('markPreparingForLesson');

  if (idToken && endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, sessionId, tutorId }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.success) return payload;
      }
    } catch (err) {
      console.warn('markPreparingForLesson endpoint failed, falling back to direct write:', err);
    }
  }

  // Fallback direct write
  const now = Date.now();
  const prepGraceMs = 5 * 60 * 1000;
  const reqRef = doc(db, 'classRequests', requestId);
  await updateDoc(reqRef, {
    status: 'preparing_for_lesson',
    statusDetail: 'Tutor and student are preparing for the lesson.',
    preparingStartedAt: now,
    preparationGraceStartedAt: now,
    preparationGraceEndsAt: now + prepGraceMs,
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  const effSessionId = sessionId || requestId;
  if (effSessionId) {
    const sRef = doc(db, 'sessions', effSessionId);
    await updateDoc(sRef, {
      status: 'preparing_for_lesson',
      preparingStartedAt: now,
      preparationGraceStartedAt: now,
      preparationGraceEndsAt: now + prepGraceMs,
      updatedAt: serverTimestamp(),
    }).catch(() => null);
  }

  await updateLiveTracking(requestId, {
    status: 'preparing_for_lesson',
    preparingStartedAtMs: now,
    preparationGraceStartedAtMs: now,
    preparationGraceEndsAt: now + prepGraceMs,
    preparationGraceEndsAtMs: now + prepGraceMs,
    updatedAtMs: now,
  }).catch(() => null);

  return {
    success: true,
    status: 'preparing_for_lesson',
    preparingStartedAt: now,
    preparationGraceEndsAt: now + prepGraceMs,
  };
}

export async function startInPersonLesson({ requestId, sessionId }) {
  const effSessionId = sessionId || requestId;
  if (!effSessionId) return null;
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('startInPersonLesson');

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
      console.warn('startInPersonLesson endpoint failed, falling back to direct write:', err);
    }
  }

  // Fallback direct write
  const now = Date.now();
  if (requestId) {
    const reqRef = doc(db, 'classRequests', requestId);
    await updateDoc(reqRef, {
      status: 'in_session',
      statusDetail: 'Lesson in progress.',
      lessonStartedAt: now,
      startedAt: now,
      updatedAt: serverTimestamp(),
    }).catch(() => null);

    await updateLiveTracking(requestId, {
      status: 'in_session',
      startedAtMs: now,
      updatedAtMs: now,
    }).catch(() => null);
  }

  const sRef = doc(db, 'sessions', effSessionId);
  await updateDoc(sRef, {
    status: 'in_session',
    lessonStartedAt: now,
    startedAt: now,
    billingStartedAt: now,
    mode: 'in_person',
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  return { success: true, status: 'in_session', startedAt: now };
}

export async function requestEndLesson({ requestId, sessionId }) {
  const effSessionId = sessionId || requestId;
  if (!effSessionId) return;
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('requestEndInPersonLesson');

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
      console.warn('requestEndLesson endpoint failed, falling back to direct write:', err);
    }
  }

  const now = Date.now();
  const uid = auth.currentUser?.uid || '';
  const sRef = doc(db, 'sessions', effSessionId);
  await updateDoc(sRef, {
    status: 'ending_requested',
    endRequestedBy: uid,
    endRequestedAt: now,
    updatedAt: serverTimestamp(),
  }).catch(() => null);

  if (requestId) {
    const reqRef = doc(db, 'classRequests', requestId);
    await updateDoc(reqRef, {
      status: 'ending_requested',
      endRequestedBy: uid,
      endRequestedAt: now,
      statusDetail: 'Lesson completion requested.',
      updatedAt: serverTimestamp(),
    }).catch(() => null);

    await updateLiveTracking(requestId, {
      status: 'ending_requested',
      endRequestedBy: uid,
      endRequestedAtMs: now,
      updatedAtMs: now,
    }).catch(() => null);
  }

  return { success: true, status: 'ending_requested', endRequestedAt: now };
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
      console.warn('confirmEndLesson endpoint failed, falling back to finalizeSessionClosure:', err);
    }
  }

  const currentSession = session || { id: effSessionId, requestId };
  return finalizeSessionClosure(currentSession, { closureType: 'completed' });
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
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('cancelInPersonLesson');

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
          reason,
          distanceTravelledKm,
          totalRouteKm,
        }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.success) return payload;
      }
    } catch (err) {
      console.warn('cancelInPersonLesson endpoint error, falling back to local closure:', err);
    }
  }

  const effSessionId = sessionId || requestId || session?.id;
  const canceledAt = Date.now();
  const closureType = canceledBy === 'tutor' ? 'canceled_by_tutor' : 'canceled_by_student';

  // 1. Unconditionally update classRequests doc in Firestore
  if (requestId) {
    try {
      const reqRef = doc(db, 'classRequests', requestId);
      await updateDoc(reqRef, {
        status: 'canceled',
        statusDetail: canceledBy === 'tutor' ? 'Request canceled by tutor.' : 'Request canceled by student.',
        canceledAt,
        canceledBy,
        canceledReason: reason || '',
        currentOfferTutorId: null,
        offerExpiresAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch (reqErr) {
      console.warn('cancelInPersonSession Firestore classRequests update warning:', reqErr);
    }

    // 2. Unconditionally update RTDB liveTracking
    try {
      await updateLiveTracking(requestId, {
        status: 'canceled',
        canceledBy,
        closedAtMs: canceledAt,
        closedReason: reason || '',
        updatedAtMs: canceledAt,
      });
    } catch (rtdbErr) {
      console.warn('cancelInPersonSession RTDB liveTracking update warning:', rtdbErr);
    }
  }

  // 3. Update sessions doc in Firestore if effSessionId exists
  if (effSessionId) {
    try {
      const sRef = doc(db, 'sessions', effSessionId);
      await updateDoc(sRef, {
        status: 'canceled',
        endedAt: canceledAt,
        canceledAt,
        canceledBy,
        canceledReason: reason || '',
        updatedAt: serverTimestamp(),
      });
    } catch (_sErr) {
      // Session document may not exist if request was canceled prior to acceptance
    }
  }

  // 4. Attempt billing closure, but NEVER let errors crash or revert the cancellation
  const currentSession = session || { id: effSessionId, requestId };
  try {
    const finalSession = await finalizeSessionClosure(currentSession, {
      closureType,
      canceledBy,
      canceledReason: reason,
    });
    return { success: true, status: 'canceled', session: finalSession };
  } catch (closureErr) {
    console.warn('cancelInPersonSession finalizeSessionClosure warning (local cancel succeeded):', closureErr?.message);
    return { success: true, status: 'canceled', requestId, sessionId: effSessionId };
  }
}

