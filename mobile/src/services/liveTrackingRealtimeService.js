import { onValue, ref, update } from 'firebase/database';
import { getFirebaseClients } from '../firebase/config';

const LIVE_TRACKING_ROOT = 'liveTracking/classRequests';

function normalizeCoordinate(coordinate = null) {
  if (!coordinate) return null;
  const rawLat = coordinate?.latitude ?? coordinate?.lat;
  const rawLng = coordinate?.longitude ?? coordinate?.lng;
  if (rawLat == null || rawLng == null) return null;
  const latitude = Number(rawLat);
  const longitude = Number(rawLng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const rawHeading = coordinate?.heading ?? coordinate?.bearing;
  const rawSpeed = coordinate?.speed;
  const rawAccuracy = coordinate?.accuracy;
  const rawAltitude = coordinate?.altitude;
  const rawAltAcc = coordinate?.altitudeAccuracy;
  const rawTime = coordinate?.updatedAtMs ?? coordinate?.time;

  return {
    latitude,
    longitude,
    accuracy: rawAccuracy != null && Number.isFinite(Number(rawAccuracy)) ? Number(rawAccuracy) : null,
    altitude: rawAltitude != null && Number.isFinite(Number(rawAltitude)) ? Number(rawAltitude) : null,
    altitudeAccuracy: rawAltAcc != null && Number.isFinite(Number(rawAltAcc)) ? Number(rawAltAcc) : null,
    heading: rawHeading != null && Number.isFinite(Number(rawHeading)) ? Number(rawHeading) : null,
    speed: rawSpeed != null && Number.isFinite(Number(rawSpeed)) ? Number(rawSpeed) : null,
    updatedAtMs: rawTime != null && Number.isFinite(Number(rawTime)) ? Number(rawTime) : Date.now(),
  };
}

function normalizeRouteSnapshot(routeSnapshot = null) {
  if (!routeSnapshot || typeof routeSnapshot !== 'object') {
    return null;
  }

  return {
    routeCoordinates: Array.isArray(routeSnapshot.routeCoordinates) ? routeSnapshot.routeCoordinates : [],
    routeSteps: Array.isArray(routeSnapshot.routeSteps) ? routeSnapshot.routeSteps : [],
    encodedPolyline: String(routeSnapshot.encodedPolyline || '').trim(),
    overviewEncodedPolyline: String(routeSnapshot.overviewEncodedPolyline || '').trim(),
    distanceMeters: routeSnapshot.distanceMeters != null && Number.isFinite(Number(routeSnapshot.distanceMeters))
      ? Number(routeSnapshot.distanceMeters)
      : null,
    durationSeconds: routeSnapshot.durationSeconds != null && Number.isFinite(Number(routeSnapshot.durationSeconds))
      ? Number(routeSnapshot.durationSeconds)
      : null,
    routeProvider: String(routeSnapshot.routeProvider || '').trim(),
    lastRouteOrigin: normalizeCoordinate(routeSnapshot.lastRouteOrigin),
    lastDestination: normalizeCoordinate(routeSnapshot.lastDestination),
    lastSuccessfulRouteFetchAtMs: routeSnapshot.lastSuccessfulRouteFetchAtMs != null && Number.isFinite(Number(routeSnapshot.lastSuccessfulRouteFetchAtMs))
      ? Number(routeSnapshot.lastSuccessfulRouteFetchAtMs)
      : 0,
  };
}

function normalizeLiveTrackingSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const routeSnapshot = normalizeRouteSnapshot(snapshot.routeSnapshot);

  const rawDist = snapshot.distanceMeters ?? routeSnapshot?.distanceMeters;
  const rawDur = snapshot.durationSeconds ?? routeSnapshot?.durationSeconds;
  const rawTravelStart = snapshot.travelStartedAtMs ?? snapshot.startedTravellingAtMs;
  const rawStartedTrav = snapshot.startedTravellingAtMs ?? snapshot.travelStartedAtMs;

  return {
    requestId: String(snapshot.requestId || '').trim(),
    sessionId: String(snapshot.sessionId || '').trim(),
    tutorId: String(snapshot.tutorId || '').trim(),
    tutorName: String(snapshot.tutorName || '').trim(),
    studentId: String(snapshot.studentId || '').trim(),
    studentName: String(snapshot.studentName || '').trim(),
    tutorLocation: normalizeCoordinate(snapshot.tutorLocation),
    studentLocation: normalizeCoordinate(snapshot.studentLocation),
    destination: normalizeCoordinate(snapshot.destination),
    meetingCoordinates: normalizeCoordinate(snapshot.meetingCoordinates),
    routeSnapshot,
    routeSteps: Array.isArray(routeSnapshot?.routeSteps) ? routeSnapshot.routeSteps : [],
    routePolylineEncoded: String(routeSnapshot?.encodedPolyline || '').trim(),
    routePolylineOverviewEncoded: String(routeSnapshot?.overviewEncodedPolyline || '').trim(),
    distanceMeters: rawDist != null && Number.isFinite(Number(rawDist)) ? Number(rawDist) : null,
    durationSeconds: rawDur != null && Number.isFinite(Number(rawDur)) ? Number(rawDur) : null,
    distanceRemainingMeters: snapshot.distanceRemainingMeters != null && Number.isFinite(Number(snapshot.distanceRemainingMeters))
      ? Number(snapshot.distanceRemainingMeters)
      : null,
    etaSeconds: snapshot.etaSeconds != null && Number.isFinite(Number(snapshot.etaSeconds)) ? Number(snapshot.etaSeconds) : null,
    status: String(snapshot.status || '').trim(),
    statusDetail: String(snapshot.statusDetail || '').trim(),
    mode: String(snapshot.mode || 'in_person').trim(),
    acceptedAtMs: snapshot.acceptedAtMs != null && Number.isFinite(Number(snapshot.acceptedAtMs)) ? Number(snapshot.acceptedAtMs) : 0,
    travelStartedAtMs: rawTravelStart != null && Number.isFinite(Number(rawTravelStart)) ? Number(rawTravelStart) : 0,
    startedTravellingAtMs: rawStartedTrav != null && Number.isFinite(Number(rawStartedTrav)) ? Number(rawStartedTrav) : 0,
    arrivalGraceEndsAt: snapshot.arrivalGraceEndsAt != null && Number.isFinite(Number(snapshot.arrivalGraceEndsAt))
      ? Number(snapshot.arrivalGraceEndsAt)
      : null,
    preparationGraceEndsAt: snapshot.preparationGraceEndsAt != null && Number.isFinite(Number(snapshot.preparationGraceEndsAt))
      ? Number(snapshot.preparationGraceEndsAt)
      : null,
    startedAtMs: snapshot.startedAtMs != null && Number.isFinite(Number(snapshot.startedAtMs)) ? Number(snapshot.startedAtMs) : 0,
    closedAtMs: snapshot.closedAtMs != null && Number.isFinite(Number(snapshot.closedAtMs)) ? Number(snapshot.closedAtMs) : 0,
    closedReason: String(snapshot.closedReason || '').trim(),
    updatedAtMs: snapshot.updatedAtMs != null && Number.isFinite(Number(snapshot.updatedAtMs)) ? Number(snapshot.updatedAtMs) : 0,
  };
}

function sanitizePatch(patch = {}) {
  const nextPatch = {};

  if (patch.requestId !== undefined) nextPatch.requestId = String(patch.requestId || '').trim();
  if (patch.tutorId !== undefined) nextPatch.tutorId = String(patch.tutorId || '').trim();
  if (patch.studentId !== undefined) nextPatch.studentId = String(patch.studentId || '').trim();
  if (patch.status !== undefined) nextPatch.status = String(patch.status || '').trim();
  if (patch.mode !== undefined) nextPatch.mode = String(patch.mode || 'online').trim();

  if (patch.acceptedAtMs !== undefined) {
    nextPatch.acceptedAtMs = Number.isFinite(Number(patch.acceptedAtMs)) ? Number(patch.acceptedAtMs) : Date.now();
  }
  if (patch.startedAtMs !== undefined) {
    nextPatch.startedAtMs = Number.isFinite(Number(patch.startedAtMs)) ? Number(patch.startedAtMs) : Date.now();
  }
  if (patch.closedAtMs !== undefined) {
    nextPatch.closedAtMs = Number.isFinite(Number(patch.closedAtMs)) ? Number(patch.closedAtMs) : Date.now();
  }
  if (patch.closedReason !== undefined) nextPatch.closedReason = String(patch.closedReason || '').trim();
  if (patch.updatedAtMs !== undefined) {
    nextPatch.updatedAtMs = Number.isFinite(Number(patch.updatedAtMs)) ? Number(patch.updatedAtMs) : Date.now();
  } else {
    nextPatch.updatedAtMs = Date.now();
  }

  if (patch.tutorLocation !== undefined) {
    nextPatch.tutorLocation = normalizeCoordinate(patch.tutorLocation);
  }
  if (patch.studentLocation !== undefined) {
    nextPatch.studentLocation = normalizeCoordinate(patch.studentLocation);
  }
  if (patch.destination !== undefined) {
    nextPatch.destination = normalizeCoordinate(patch.destination);
  }
  if (patch.routeSnapshot !== undefined) {
    nextPatch.routeSnapshot = normalizeRouteSnapshot(patch.routeSnapshot);
  }
  if (patch.distanceMeters !== undefined) {
    nextPatch.distanceMeters = Number.isFinite(Number(patch.distanceMeters)) ? Number(patch.distanceMeters) : null;
  }
  if (patch.durationSeconds !== undefined) {
    nextPatch.durationSeconds = Number.isFinite(Number(patch.durationSeconds)) ? Number(patch.durationSeconds) : null;
  }
  if (patch.distanceRemainingMeters !== undefined) {
    nextPatch.distanceRemainingMeters = Number.isFinite(Number(patch.distanceRemainingMeters))
      ? Number(patch.distanceRemainingMeters)
      : null;
  }
  if (patch.etaSeconds !== undefined) {
    nextPatch.etaSeconds = Number.isFinite(Number(patch.etaSeconds)) ? Number(patch.etaSeconds) : null;
  }

  return nextPatch;
}

export async function updateLiveTracking(requestId, patch = {}) {
  const requestKey = String(requestId || '').trim();
  if (!requestKey) return;

  const { realtimeDb } = getFirebaseClients();
  const sanitized = sanitizePatch(patch);
  const liveRef = ref(realtimeDb, `${LIVE_TRACKING_ROOT}/${requestKey}`);

  await update(liveRef, sanitized);
}

export function subscribeToLiveTracking(requestId, callback, onError) {
  const requestKey = String(requestId || '').trim();
  if (!requestKey) {
    callback?.(null);
    return () => {};
  }

  const { realtimeDb } = getFirebaseClients();
  const liveRef = ref(realtimeDb, `${LIVE_TRACKING_ROOT}/${requestKey}`);

  return onValue(
    liveRef,
    (snapshot) => {
      const data = snapshot.val();
      callback?.(normalizeLiveTrackingSnapshot(data));
    },
    (error) => {
      console.warn('[live-tracking-subscription-error]', error?.message || error);
      onError?.(error);
    }
  );
}

export async function closeLiveTracking(requestId, reason = 'closed') {
  const requestKey = String(requestId || '').trim();
  if (!requestKey) return;

  const now = Date.now();
  return updateLiveTracking(requestKey, {
    status: 'closed',
    closedReason: String(reason || 'closed').trim(),
    closedAtMs: now,
    updatedAtMs: now,
  });
}
