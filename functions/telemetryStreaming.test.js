const test = require('node:test');
const assert = require('node:assert/strict');

// 1. Core normalization function matching mobile/src/services/liveTrackingRealtimeService.js
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

// 2. Haversine distance helper to calculate displacement between coordinates in meters
function computeDisplacementMeters(coordA, coordB) {
  if (!coordA || !coordB) return Infinity;
  const lat1 = Number(coordA.latitude ?? coordA.lat);
  const lon1 = Number(coordA.longitude ?? coordA.lng);
  const lat2 = Number(coordB.latitude ?? coordB.lat);
  const lon2 = Number(coordB.longitude ?? coordB.lng);

  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Infinity;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

test('RTDB telemetry snapshot normalizes tutor coordinate with heading, speed and aliases', () => {
  const rawRtdbPayload = {
    requestId: 'req_123',
    sessionId: 'req_123',
    tutorId: 'tut_456',
    tutorName: 'Sarah M.',
    studentId: 'stu_789',
    studentName: 'Thabo N.',
    status: 'travelling',
    mode: 'in_person',
    tutorLocation: {
      latitude: -26.1952,
      longitude: 28.0340,
      heading: 184.5,
      speed: 12.3,
      accuracy: 4.5,
      updatedAtMs: 1726000000000,
    },
    studentLocation: {
      lat: -26.2041,
      lng: 28.0473,
    },
    distanceRemainingMeters: 3200,
    etaSeconds: 420,
    startedTravellingAtMs: 1726000000000,
  };

  const normalized = normalizeLiveTrackingSnapshot(rawRtdbPayload);

  assert.equal(normalized.requestId, 'req_123');
  assert.equal(normalized.status, 'travelling');
  assert.equal(normalized.tutorLocation.latitude, -26.1952);
  assert.equal(normalized.tutorLocation.longitude, 28.0340);
  assert.equal(normalized.tutorLocation.heading, 184.5);
  assert.equal(normalized.tutorLocation.speed, 12.3);
  assert.equal(normalized.studentLocation.latitude, -26.2041);
  assert.equal(normalized.studentLocation.longitude, 28.0473);
  assert.equal(normalized.distanceRemainingMeters, 3200);
  assert.equal(normalized.etaSeconds, 420);
  assert.equal(normalized.travelStartedAtMs, 1726000000000);
  assert.equal(normalized.startedTravellingAtMs, 1726000000000);
});

test('RTDB telemetry snapshot supports bearing alias and lat/lng aliases for tutor location', () => {
  const raw = {
    tutorLocation: {
      lat: -26.1800,
      lng: 28.0200,
      bearing: 90.0,
      speed: 15.0,
    },
  };

  const normalized = normalizeLiveTrackingSnapshot(raw);
  assert.equal(normalized.tutorLocation.latitude, -26.1800);
  assert.equal(normalized.tutorLocation.longitude, 28.0200);
  assert.equal(normalized.tutorLocation.heading, 90.0);
  assert.equal(normalized.tutorLocation.speed, 15.0);
});

test('Live ETA and remaining distance precedence prioritizes real-time RTDB values over static route metadata', () => {
  const routeMeta = {
    durationSeconds: 900, // 15 mins (stale initial route calculation)
    distanceMeters: 6500, // 6.5 km (stale initial distance)
  };

  const liveTracking = {
    etaSeconds: 240, // 4 mins (active real-time countdown)
    distanceRemainingMeters: 1800, // 1.8 km (active real-time remaining distance)
  };

  // Precedence rule: liveTracking.etaSeconds ?? routeMeta.durationSeconds
  const effectiveEta = liveTracking?.etaSeconds ?? routeMeta?.durationSeconds ?? liveTracking?.durationSeconds;
  const effectiveDistance = liveTracking?.distanceRemainingMeters ?? liveTracking?.distanceMeters ?? routeMeta?.distanceMeters;

  assert.equal(effectiveEta, 240, 'Live ETA countdown must take precedence over stale initial route duration');
  assert.equal(effectiveDistance, 1800, 'Live remaining distance must take precedence over stale initial route distance');

  // Fallback when live tracking has not yet computed remaining values
  const emptyLiveTracking = {};
  const fallbackEta = emptyLiveTracking?.etaSeconds ?? routeMeta?.durationSeconds ?? emptyLiveTracking?.durationSeconds;
  const fallbackDistance = emptyLiveTracking?.distanceRemainingMeters ?? emptyLiveTracking?.distanceMeters ?? routeMeta?.distanceMeters;

  assert.equal(fallbackEta, 900, 'Falls back cleanly to initial route duration when live telemetry ETA is absent');
  assert.equal(fallbackDistance, 6500, 'Falls back cleanly to initial route distance when live remaining distance is absent');
});

test('Route recalculation threshold throttles requests when displacement is under 150 meters', () => {
  const RECALCULATE_DISPLACEMENT_METERS = 150;

  const origin = { latitude: -26.2041, longitude: 28.0473 };

  // Small displacement (~40 meters away)
  const minorMove = { latitude: -26.2044, longitude: 28.0475 };
  const dMinor = computeDisplacementMeters(origin, minorMove);
  assert.ok(dMinor < RECALCULATE_DISPLACEMENT_METERS, `Displacement ${dMinor}m should be under 150m threshold`);
  const shouldRecalculateMinor = dMinor >= RECALCULATE_DISPLACEMENT_METERS;
  assert.equal(shouldRecalculateMinor, false, 'Should throttle Directions API query on small displacement');

  // Significant displacement (~350 meters away)
  const majorMove = { latitude: -26.2070, longitude: 28.0490 };
  const dMajor = computeDisplacementMeters(origin, majorMove);
  assert.ok(dMajor >= RECALCULATE_DISPLACEMENT_METERS, `Displacement ${dMajor}m should exceed 150m threshold`);
  const shouldRecalculateMajor = dMajor >= RECALCULATE_DISPLACEMENT_METERS;
  assert.equal(shouldRecalculateMajor, true, 'Should trigger Directions API query on significant displacement');
});

test('Grace period countdowns synchronize across arrival and preparation transitions', () => {
  const now = Date.now();
  const arrivalGraceEndsAt = now + (5 * 60 * 1000); // 5 minutes arrival grace
  const preparationGraceEndsAt = now + (5 * 60 * 1000); // 5 minutes preparation grace

  const snapshotWithGrace = {
    status: 'arrived',
    arrivalGraceEndsAt,
    preparationGraceEndsAt: null,
  };

  const normalized = normalizeLiveTrackingSnapshot(snapshotWithGrace);
  assert.equal(normalized.status, 'arrived');
  assert.equal(normalized.arrivalGraceEndsAt, arrivalGraceEndsAt);
  assert.equal(normalized.preparationGraceEndsAt, null);

  const prepSnapshot = {
    status: 'preparing_for_lesson',
    arrivalGraceEndsAt,
    preparationGraceEndsAt,
  };

  const normalizedPrep = normalizeLiveTrackingSnapshot(prepSnapshot);
  assert.equal(normalizedPrep.status, 'preparing_for_lesson');
  assert.equal(normalizedPrep.arrivalGraceEndsAt, arrivalGraceEndsAt);
  assert.equal(normalizedPrep.preparationGraceEndsAt, preparationGraceEndsAt);
});
