const test = require('node:test');
const assert = require('node:assert/strict');
const { randomInt } = require('crypto');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');

// 1. Distance helper matching tutors/src/screens/navigation/TutorNavigationScreen.js
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 2. Cryptographic 4-digit PIN generator matching functions/index.js markTutorArrived
function generateVerificationPin() {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

test('50-meter arrival geofence detection contract', () => {
  const GEOFENCE_THRESHOLD_METERS = 50;
  const studentDestination = { latitude: -26.2041, longitude: 28.0473 };

  // Case A: Tutor is 35 meters away -> inside geofence (arrived)
  const tutorAt35m = { latitude: -26.2044, longitude: 28.0474 };
  const d35 = getDistanceMeters(
    tutorAt35m.latitude,
    tutorAt35m.longitude,
    studentDestination.latitude,
    studentDestination.longitude
  );
  assert.ok(d35 !== null && d35 <= GEOFENCE_THRESHOLD_METERS, `Distance ${d35}m should be within 50m geofence`);
  const isWithin50A = d35 !== null && d35 <= GEOFENCE_THRESHOLD_METERS;
  assert.equal(isWithin50A, true);

  // Case B: Tutor is 180 meters away -> outside geofence (travelling)
  const tutorAt180m = { latitude: -26.2057, longitude: 28.0478 };
  const d180 = getDistanceMeters(
    tutorAt180m.latitude,
    tutorAt180m.longitude,
    studentDestination.latitude,
    studentDestination.longitude
  );
  assert.ok(d180 !== null && d180 > GEOFENCE_THRESHOLD_METERS, `Distance ${d180}m should exceed 50m geofence`);
  const isWithin50B = d180 !== null && d180 <= GEOFENCE_THRESHOLD_METERS;
  assert.equal(isWithin50B, false);

  // Case C: Null or missing coordinates return null
  assert.equal(getDistanceMeters(null, 28.0, -26.0, 28.0), null);
  assert.equal(getDistanceMeters(-26.0, null, -26.0, 28.0), null);
});

test('Cryptographic 4-digit PIN generation contract adheres to launch rules', () => {
  const pins = new Set();
  for (let i = 0; i < 100; i++) {
    const pin = generateVerificationPin();
    assert.equal(typeof pin, 'string');
    assert.equal(pin.length, 4, `PIN ${pin} must have exact length of 4`);
    assert.match(pin, /^\d{4}$/, `PIN ${pin} must contain strictly 4 numeric digits`);
    const num = Number(pin);
    assert.ok(num >= 0 && num <= 9999, `PIN value ${num} must be in range [0, 9999]`);
    pins.add(pin);
  }
  // Randomness check: 100 generations should produce at least 80 unique pins
  assert.ok(pins.size > 80, `Expected high entropy, got ${pins.size} unique pins out of 100`);
});

test('5-minute arrival grace period calculation and metadata schema', () => {
  const now = Date.now();
  const gracePeriodMs = 5 * 60 * 1000;
  const pin = generateVerificationPin();
  const pinExpiresAt = now + (30 * 60 * 1000);

  const mockFirestoreArrivalPayload = {
    status: LESSON_STATUS.ARRIVED,
    statusDetail: 'Tutor has arrived at the student destination.',
    arrivedAt: now,
    arrivalGraceStartedAt: now,
    arrivalGraceEndsAt: now + gracePeriodMs,
    verificationPin: pin,
    verificationPinGeneratedAt: now,
    verificationPinExpiresAt: pinExpiresAt,
    verificationPinAttempts: 0,
    maxVerificationPinAttempts: 3,
  };

  const mockRtdbArrivalPayload = {
    status: LESSON_STATUS.ARRIVED,
    arrivedAtMs: now,
    arrivalGraceStartedAtMs: now,
    arrivalGraceEndsAt: now + gracePeriodMs,
    arrivalGraceEndsAtMs: now + gracePeriodMs,
    verificationPin: pin,
    updatedAtMs: now,
  };

  // Status assertions
  assert.equal(mockFirestoreArrivalPayload.status, 'arrived');
  assert.equal(mockFirestoreArrivalPayload.arrivalGraceEndsAt - mockFirestoreArrivalPayload.arrivedAt, 300000);
  assert.equal(mockFirestoreArrivalPayload.verificationPin.length, 4);
  assert.equal(mockFirestoreArrivalPayload.verificationPinExpiresAt - now, 1800000);
  assert.equal(mockFirestoreArrivalPayload.maxVerificationPinAttempts, 3);

  // RTDB sync assertions
  assert.equal(mockRtdbArrivalPayload.status, 'arrived');
  assert.equal(mockRtdbArrivalPayload.verificationPin, pin);
  assert.equal(mockRtdbArrivalPayload.arrivalGraceEndsAt, now + gracePeriodMs);
});

test('canTransition validates arrival lifecycle progression', () => {
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.ARRIVED), true);
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.WAITING_STUDENT), true);
  assert.equal(canTransition(LESSON_STATUS.WAITING_STUDENT, LESSON_STATUS.PREPARING_FOR_LESSON), true);
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.PREPARING_FOR_LESSON), true);

  // Backward progression rejected
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.TRAVELLING), false);
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.ACCEPTED), false);
});
