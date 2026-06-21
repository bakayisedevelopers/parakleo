import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';

const SUBMIT_CLASS_REQUEST_ENDPOINT = getFunctionEndpoint('submitClassRequest');

export async function createClassRequest(payload) {
  const requestBody = {
    ...payload,
    subject: payload.subject || 'Mathematics',
    durationMinutes: Number(payload.durationMinutes || 10),
    pricingSnapshot: payload.pricingSnapshot || null,
    pricingQuoteId: payload.pricingSnapshot?.quoteId || null,
    mode: 'online',
    meetingProviderPreference: payload.meetingProviderPreference || 'any',
    status: 'pending',
    tutorId: null,
    tutorName: null,
    tutorEmail: null,
    tutorQueue: [],
    currentOfferTutorId: null,
    offerExpiresAt: null,
    imageAttachment: payload.imageAttachment || '',
    attachment: payload.attachment || null,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments
      : (payload.attachment ? [payload.attachment] : []),
    statusDetail: 'Request submitted. Initializing tutor matching.',
    ratings: {
      student: null,
      tutor: null,
    },
    ratingStatus: {
      student: 'pending',
      tutor: 'pending',
    },
  };
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error('You must be signed in before submitting a class request.');
  }

  const response = await fetch(SUBMIT_CLASS_REQUEST_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false || !result?.requestId) {
    throw new Error(result?.message || 'Unable to submit request right now.');
  }

  return result.requestId;
}

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

export function subscribeToRequestById(requestId, callback, onError) {
  if (!requestId) {
    callback(null);
    return () => {};
  }

  const { db } = getFirebaseClients();
  return onSnapshot(
    doc(db, 'classRequests', requestId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export async function cancelClassRequest({ requestId, canceledBy, reason }) {
  const trimmedReason = String(reason || '').trim();
  const { db } = getFirebaseClients();
  const canceledAt = Date.now();
  const requestPatch = {
    status: 'canceled',
    statusDetail: 'Request canceled by student.',
    canceledAt,
    canceledBy: canceledBy || 'student',
    canceledReason: trimmedReason,
    currentOfferTutorId: null,
    offerExpiresAt: null,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'classRequests', requestId), requestPatch);

  const sessionsQuery = query(collection(db, 'sessions'), where('requestId', '==', requestId));
  const sessionsSnapshot = await getDocs(sessionsQuery);
  if (!sessionsSnapshot.docs.length) {
    return;
  }

  const batch = writeBatch(db);
  let updatesCount = 0;

  sessionsSnapshot.docs.forEach((sessionDoc) => {
    const session = sessionDoc.data() || {};
    if (!['waiting_student', 'in_progress', 'in_session'].includes(String(session.status || '').toLowerCase())) {
      return;
    }

    updatesCount += 1;
    batch.update(sessionDoc.ref, {
      status: 'canceled',
      endedAt: canceledAt,
      canceledAt,
      canceledBy: canceledBy || 'student',
      canceledReason: trimmedReason,
      updatedAt: serverTimestamp(),
    });
  });

  if (updatesCount) {
    await batch.commit();
  }
}
