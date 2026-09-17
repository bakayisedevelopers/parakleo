import { onValue, ref, update } from 'firebase/database';
import { getFirebaseClients } from '../firebase/config';

const LIVE_TRACKING_ROOT = 'liveTracking/classRequests';

function normalizeCoordinate(coordinate = null) {
  const latitude = Number(coordinate?.latitude);
  const longitude = Number(coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(coordinate?.accuracy)) ? Number(coordinate.accuracy) : null,
    altitude: Number.isFinite(Number(coordinate?.altitude)) ? Number(coordinate.altitude) : null,
    altitudeAccuracy: Number.isFinite(Number(coordinate?.altitudeAccuracy)) ? Number(coordinate.altitudeAccuracy) : null,
    heading: Number.isFinite(Number(coordinate?.heading)) ? Number(coordinate.heading) : null,
    speed: Number.isFinite(Number(coordinate?.speed)) ? Number(coordinate.speed) : null,
    updatedAtMs: Number.isFinite(Number(coordinate?.updatedAtMs)) ? Number(coordinate.updatedAtMs) : Date.now(),
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
    distanceMeters: Number.isFinite(Number(routeSnapshot.distanceMeters)) ? Number(routeSnapshot.distanceMeters) : null,
    durationSeconds: Number.isFinite(Number(routeSnapshot.durationSeconds)) ? Number(routeSnapshot.durationSeconds) : null,
    routeProvider: String(routeSnapshot.routeProvider || '').trim(),
    lastRouteOrigin: normalizeCoordinate(routeSnapshot.lastRouteOrigin),
    lastDestination: normalizeCoordinate(routeSnapshot.lastDestination),
    lastSuccessfulRouteFetchAtMs: Number.isFinite(Number(routeSnapshot.lastSuccessfulRouteFetchAtMs))
      ? Number(routeSnapshot.lastSuccessfulRouteFetchAtMs)
      : 0,
  };
}

function normalizeLiveTrackingSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const routeSnapshot = normalizeRouteSnapshot(snapshot.routeSnapshot);

  return {
    requestId: String(snapshot.requestId || '').trim(),
    tutorId: String(snapshot.tutorId || '').trim(),
    studentId: String(snapshot.studentId || '').trim(),
    tutorLocation: normalizeCoordinate(snapshot.tutorLocation),
    studentLocation: normalizeCoordinate(snapshot.studentLocation),
    destination: normalizeCoordinate(snapshot.destination),
    routeSnapshot,
    routeSteps: Array.isArray(routeSnapshot?.routeSteps) ? routeSnapshot.routeSteps : [],
    routePolylineEncoded: String(routeSnapshot?.encodedPolyline || '').trim(),
    routePolylineOverviewEncoded: String(routeSnapshot?.overviewEncodedPolyline || '').trim(),
    distanceMeters: Number.isFinite(Number(snapshot.distanceMeters ?? routeSnapshot?.distanceMeters))
      ? Number(snapshot.distanceMeters ?? routeSnapshot?.distanceMeters)
      : null,
    durationSeconds: Number.isFinite(Number(snapshot.durationSeconds ?? routeSnapshot?.durationSeconds))
      ? Number(snapshot.durationSeconds ?? routeSnapshot?.durationSeconds)
      : null,
    distanceRemainingMeters: Number.isFinite(Number(snapshot.distanceRemainingMeters))
      ? Number(snapshot.distanceRemainingMeters)
      : null,
    etaSeconds: Number.isFinite(Number(snapshot.etaSeconds)) ? Number(snapshot.etaSeconds) : null,
    status: String(snapshot.status || '').trim(),
    mode: String(snapshot.mode || 'online').trim(),
    acceptedAtMs: Number.isFinite(Number(snapshot.acceptedAtMs)) ? Number(snapshot.acceptedAtMs) : 0,
    startedAtMs: Number.isFinite(Number(snapshot.startedAtMs)) ? Number(snapshot.startedAtMs) : 0,
    closedAtMs: Number.isFinite(Number(snapshot.closedAtMs)) ? Number(snapshot.closedAtMs) : 0,
    closedReason: String(snapshot.closedReason || '').trim(),
    updatedAtMs: Number.isFinite(Number(snapshot.updatedAtMs)) ? Number(snapshot.updatedAtMs) : 0,
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
      console.warn('[tutors:live-tracking-subscription-error]', error?.message || error);
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
