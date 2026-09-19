import {
  addDoc,
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
import { updateLiveTracking } from './liveTrackingRealtimeService';

const SUBMIT_CLASS_REQUEST_ENDPOINT = getFunctionEndpoint('submitClassRequest');
export const CLASS_REQUEST_EXPIRY_MS = 3 * 60 * 1000;

export const EXPIRABLE_CLASS_REQUEST_STATUSES = [
  'pending',
  'matching',
  'offered',
  'no_tutor_available',
];

export function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  if (Number.isFinite(Number(value?._seconds))) return Number(value._seconds) * 1000;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getClassRequestCreatedAtMs(request = null) {
  return timestampToMillis(request?.createdAtMs)
    || timestampToMillis(request?.createdAt)
    || timestampToMillis(request?.submittedAt)
    || timestampToMillis(request?.updatedAt);
}

export function getClassRequestExpiryAtMs(request = null) {
  return timestampToMillis(request?.requestExpiresAt)
    || timestampToMillis(request?.expiresAt)
    || timestampToMillis(request?.matchingExpiresAt)
    || (() => {
      const createdAtMs = getClassRequestCreatedAtMs(request);
      return createdAtMs ? createdAtMs + CLASS_REQUEST_EXPIRY_MS : 0;
    })();
}

export function getOfferExpiresAtMs(request = null) {
  return timestampToMillis(request?.offerExpiresAt);
}

export function shouldExpireClassRequest(request = null, nowMs = Date.now()) {
  const status = String(request?.status || '').toLowerCase();
  if (!EXPIRABLE_CLASS_REQUEST_STATUSES.includes(status)) return false;

  const expiresAtMs = getClassRequestExpiryAtMs(request);
  return Boolean(expiresAtMs && nowMs >= expiresAtMs);
}

export async function expireClassRequest({ requestId, reason = 'Request expired because no tutor accepted in time.' } = {}) {
  if (!requestId) return;
  // Expiry is advanced by the backend lifecycle trigger/sweeper. Keeping this
  // as a no-op prevents the student app from racing Cloud Functions.
  console.info('[expireClassRequest] Backend lifecycle owns request expiry.', { requestId, reason });
}

export function computeHaversineDistanceKm(coord1, coord2) {
  const lat1 = Number(coord1?.latitude ?? coord1?.lat);
  const lon1 = Number(coord1?.longitude ?? coord1?.lng);
  const lat2 = Number(coord2?.latitude ?? coord2?.lat);
  const lon2 = Number(coord2?.longitude ?? coord2?.lng);
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function findEligibleOnlineTutor(subject, excludeUserId = null, studentLocation = null, safetySnapshot = null) {
  const { db } = getFirebaseClients();
  const subjectKey = String(subject || 'Mathematics').trim().toLowerCase();

  try {
    const tutorsRef = collection(db, 'users');
    let snapshot = await getDocs(
      query(tutorsRef, where('activeRole', '==', 'tutor'), where('onlineStatus', '==', 'online'))
    ).catch(() => null);

    if (!snapshot || snapshot.empty) {
      snapshot = await getDocs(
        query(tutorsRef, where('role', '==', 'tutor'), where('onlineStatus', '==', 'online'))
      ).catch(() => null);
    }

    if (!snapshot || snapshot.empty) {
      snapshot = await getDocs(
        query(tutorsRef, where('activeRole', '==', 'tutor'))
      ).catch(() => null);
    }

    if (!snapshot || snapshot.empty) {
      return null;
    }

    const tutors = snapshot.docs
      .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }))
      .filter((t) => t.uid !== excludeUserId && !t.activeSessionId);

    if (!tutors.length) {
      return null;
    }

    const preferSameGender = Boolean(safetySnapshot?.preferSameGenderTutor);
    const targetGender = String(safetySnapshot?.studentGender || '').trim().toLowerCase();

    const ranked = tutors.sort((a, b) => {
      const aSubjects = (Array.isArray(a.activeSubjects) ? a.activeSubjects : (Array.isArray(a.subjects) ? a.subjects : []))
        .map((s) => String(s || '').trim().toLowerCase());
      const bSubjects = (Array.isArray(b.activeSubjects) ? b.activeSubjects : (Array.isArray(b.subjects) ? b.subjects : []))
        .map((s) => String(s || '').trim().toLowerCase());

      const aMatches = aSubjects.includes(subjectKey) ? 1 : 0;
      const bMatches = bSubjects.includes(subjectKey) ? 1 : 0;
      if (bMatches !== aMatches) return bMatches - aMatches;

      const aOnline = a.onlineStatus === 'online' ? 1 : 0;
      const bOnline = b.onlineStatus === 'online' ? 1 : 0;
      if (bOnline !== aOnline) return bOnline - aOnline;

      if (studentLocation && Number.isFinite(Number(studentLocation.latitude ?? studentLocation.lat))) {
        const aLoc = a.liveLocation || a.location || a.tutorProfile?.liveLocation || a.tutorProfile?.location;
        const bLoc = b.liveLocation || b.location || b.tutorProfile?.liveLocation || b.tutorProfile?.location;
        const aDist = computeHaversineDistanceKm(studentLocation, aLoc);
        const bDist = computeHaversineDistanceKm(studentLocation, bLoc);
        if (aDist !== null && bDist !== null && Math.abs(aDist - bDist) > 0.5) {
          return aDist - bDist;
        }
      }

      // Soft gender preference boost (REQ-011)
      if (preferSameGender && targetGender) {
        const aGender = String(a.gender || a.tutorProfile?.gender || '').trim().toLowerCase();
        const bGender = String(b.gender || b.tutorProfile?.gender || '').trim().toLowerCase();
        const aGenderMatch = aGender && aGender === targetGender ? 1 : 0;
        const bGenderMatch = bGender && bGender === targetGender ? 1 : 0;
        if (bGenderMatch !== aGenderMatch) return bGenderMatch - aGenderMatch;
      }

      const aRating = Number(a.tutorProfile?.overallRating || 4.8);
      const bRating = Number(b.tutorProfile?.overallRating || 4.8);
      return bRating - aRating;
    });

    return ranked[0] || null;
  } catch (err) {
    console.warn('[findEligibleOnlineTutor] error querying tutors:', err);
    return null;
  }
}

export async function createClassRequest(payload) {
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();
  const studentId = payload.studentId || auth.currentUser?.uid || '';
  const createdAtMs = Date.now();
  const requestExpiresAt = createdAtMs + CLASS_REQUEST_EXPIRY_MS;
  const studentLocation = payload.studentLocation || payload.location || payload.destination || null;
  const meetingAddress = String(
    payload.meetingAddress ||
    payload.selectedLocationAddress ||
    payload.studentAddress ||
    payload.locationAddress ||
    payload.address ||
    'Current Location'
  ).trim();

  const safetySnapshot = payload.safetySnapshot || null;
  const isMinor = Boolean(safetySnapshot?.isMinor || payload.isMinor || safetySnapshot?.learnerType === 'minor');
  const guardianPresenceRequired = Boolean(safetySnapshot?.guardianPresenceRequired || payload.guardianPresenceRequired || isMinor);
  const preferSameGenderTutor = Boolean(safetySnapshot?.preferSameGenderTutor || payload.preferSameGenderTutor);
  const preferPublicMeetingPlace = Boolean(safetySnapshot?.preferPublicMeetingPlace || payload.preferPublicMeetingPlace);

  let matchedTutor = null;
  try {
    matchedTutor = await findEligibleOnlineTutor(payload.subject, studentId, studentLocation, safetySnapshot);
  } catch (_e) {
    // continue
  }

  const initialStatus = matchedTutor ? 'offered' : 'matching';
  const initialOfferTutorId = matchedTutor ? matchedTutor.uid : null;
  const initialQueue = matchedTutor ? [matchedTutor.uid] : [];
  const initialExpiresAt = matchedTutor ? Math.min(createdAtMs + 30000, requestExpiresAt) : null;
  const initialDetail = matchedTutor
    ? 'Tutor notified. Waiting for acceptance.'
    : 'Looking for available tutors...';

  const requestBody = {
    ...payload,
    studentId,
    studentName: payload.studentName || 'Student',
    studentEmail: payload.studentEmail || '',
    topic: payload.topic || payload.description || payload.subject || 'General lesson assistance',
    description: payload.description || payload.topic || '',
    subject: payload.subject || 'Mathematics',
    duration: payload.duration || `${payload.durationMinutes || 10} minutes`,
    durationMinutes: Number(payload.durationMinutes || 10),
    meetingAddress,
    studentAddress: meetingAddress,
    locationAddress: meetingAddress,
    address: meetingAddress,
    studentLocation: payload.destination || payload.meetingCoordinates || studentLocation,
    location: payload.destination || payload.meetingCoordinates || studentLocation,
    destination: payload.destination || payload.meetingCoordinates || studentLocation,
    meetingCoordinates: payload.destination || payload.meetingCoordinates || studentLocation,
    coordinates: payload.destination || payload.meetingCoordinates || studentLocation,
    paymentMethod: payload.paymentMethod || payload.paymentMethodType || (payload.selectedCardId === 'cash' ? 'cash' : 'card'),
    paymentMethodType: payload.paymentMethodType || (payload.selectedCardId === 'cash' ? 'cash' : 'card'),
    selectedCardId: payload.selectedCardId || 'cash',
    pricingSnapshot: payload.pricingSnapshot || null,
    pricingQuoteId: payload.pricingSnapshot?.quoteId || null,
    mode: payload.mode || 'in_person',
    meetingProviderPreference: payload.meetingProviderPreference || 'any',
    safetySnapshot: safetySnapshot ? {
      learnerType: isMinor ? 'minor' : 'adult',
      isMinor,
      guardianPresenceRequired,
      guardianName: safetySnapshot.guardianName || '',
      guardianRelationship: safetySnapshot.guardianRelationship || '',
      guardianPhone: safetySnapshot.guardianPhone || '',
      preferSameGenderTutor,
      preferPublicMeetingPlace,
      studentGender: safetySnapshot.studentGender || '',
    } : null,
    isMinor,
    guardianPresenceRequired,
    preferSameGenderTutor,
    preferPublicMeetingPlace,
    status: initialStatus,
    createdAtMs,
    requestExpiresAt,
    expiresAt: requestExpiresAt,
    tutorId: null,
    tutorName: matchedTutor?.name || matchedTutor?.displayName || null,
    tutorEmail: matchedTutor?.email || null,
    tutorQueue: initialQueue,
    currentOfferTutorId: initialOfferTutorId,
    offerExpiresAt: initialExpiresAt,
    imageAttachment: payload.imageAttachment || '',
    attachment: payload.attachment || null,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments
      : (payload.attachment ? [payload.attachment] : []),
    statusDetail: initialDetail,
    ratings: {
      student: null,
      tutor: null,
    },
    ratingStatus: {
      student: 'pending',
      tutor: 'pending',
    },
  };

  if (!idToken) {
    throw new Error('You must be signed in before submitting a class request.');
  }

  let createdRequestId = null;

  try {
    const response = await fetch(SUBMIT_CLASS_REQUEST_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.success !== false && result?.requestId) {
      createdRequestId = result.requestId;
    } else {
      throw new Error(result?.message || 'Unable to submit request right now.');
    }
  } catch (endpointErr) {
    throw endpointErr;
  }

  const resolvedDestination = payload.destination || payload.meetingCoordinates || studentLocation;
  await updateLiveTracking(createdRequestId, {
    requestId: createdRequestId,
    studentId,
    studentLocation: resolvedDestination,
    destination: resolvedDestination,
    meetingCoordinates: resolvedDestination,
    studentAddress: meetingAddress,
    meetingAddress,
    locationOption: payload.locationOption || 'My Location',
    tutorLocation: null,
    mode: payload.mode || 'in_person',
    safetySnapshot: requestBody.safetySnapshot,
    isMinor,
    guardianPresenceRequired,
    preferPublicMeetingPlace,
    createdAtMs,
    requestExpiresAt,
    updatedAtMs: Date.now(),
  }).catch((rtdbErr) => console.warn('[RTDB:live-tracking-init-error]', rtdbErr));

  return createdRequestId;
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
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || a.createdAtMs || 0);
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || b.createdAtMs || 0);
          return bTime - aTime;
        });
      callback(items);
    },
    (err) => {
      console.warn('[classRequestService] subscribeToStudentRequests error:', err?.message || err);
      if (typeof onError === 'function') onError(err);
    },
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
  const { auth, db } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const endpoint = getFunctionEndpoint('cancelInPersonLesson');
  const studentUid = auth.currentUser?.uid;

  if (studentUid) {
    updateDoc(doc(db, 'users', studentUid), {
      activeClassRequestId: null,
      activeSessionId: null,
      updatedAt: serverTimestamp(),
    }).catch(() => null);
  }

  if (!requestId) {
    return { success: true, alreadyTerminal: true };
  }
  if (!idToken || !endpoint) {
    throw new Error('Unable to cancel request while offline. Please try again.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestId,
      sessionId: requestId,
      canceledBy: canceledBy || 'student',
      reason: trimmedReason || 'Canceled by student',
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 409 || payload?.alreadyTerminal) {
    return { success: true, alreadyTerminal: true, ...payload };
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to cancel request right now.');
  }
  return payload;
}
