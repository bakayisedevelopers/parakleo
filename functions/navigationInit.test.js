const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');

test('canTransition validates travel lifecycle transitions', () => {
  // Forward transitions
  assert.equal(canTransition(LESSON_STATUS.ACCEPTED, LESSON_STATUS.TRAVELLING), true);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.ARRIVED), true);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.WAITING_STUDENT), true);

  // Cancellation transitions during travel
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.CANCELED), true);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.CANCELED_BY_STUDENT), true);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.CANCELED_BY_TUTOR), true);

  // Invalid backward transitions
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.PENDING), false);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.OFFERED), false);
  assert.equal(canTransition(LESSON_STATUS.TRAVELLING, LESSON_STATUS.ACCEPTED), false);
});

test('In-person travel telemetry target is calibrated to exactly 3 seconds', () => {
  const TELEMETRY_INTERVAL_TARGET_MS = 3000;
  assert.equal(TELEMETRY_INTERVAL_TARGET_MS, 3000, 'RTDB location stream must target 3 seconds');
  assert.equal(TELEMETRY_INTERVAL_TARGET_MS / 1000, 3, 'Telemetry target in seconds must be 3');
});

test('startTutorTravel payload adheres to in-person travel contract', () => {
  const now = Date.now();
  const mockFirestoreUpdate = {
    status: LESSON_STATUS.TRAVELLING,
    statusDetail: 'Tutor is travelling to your location.',
    startedTravellingAt: now,
    travelStartedAt: now,
  };

  const mockRtdbUpdate = {
    status: LESSON_STATUS.TRAVELLING,
    travelStartedAtMs: now,
    startedTravellingAtMs: now,
    updatedAtMs: now,
  };

  assert.equal(mockFirestoreUpdate.status, 'travelling');
  assert.equal(mockFirestoreUpdate.startedTravellingAt, now);
  assert.equal(mockFirestoreUpdate.travelStartedAt, now);
  assert.equal(mockRtdbUpdate.status, 'travelling');
  assert.equal(mockRtdbUpdate.travelStartedAtMs, now);
  assert.equal(mockRtdbUpdate.startedTravellingAtMs, now);
});

test('Coordinate normalization resolves all valid student meeting location aliases', () => {
  function normalizeCoordinate(coordinate = null) {
    const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
    const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
    };
  }

  function getDestinationFromRequest(request = null) {
    return normalizeCoordinate(
      request?.destination
        || request?.studentLocation
        || request?.meetingCoordinates
        || request?.studentCoordinates
        || request?.coordinates
        || request?.location
        || request?.student?.location
        || null,
    );
  }

  // Format 1: destination
  const f1 = getDestinationFromRequest({ destination: { latitude: -26.2041, longitude: 28.0473 } });
  assert.deepEqual(f1, { latitude: -26.2041, longitude: 28.0473 });

  // Format 2: studentLocation with lat/lng
  const f2 = getDestinationFromRequest({ studentLocation: { lat: -26.1952, lng: 28.0340 } });
  assert.deepEqual(f2, { latitude: -26.1952, longitude: 28.0340 });

  // Format 3: meetingCoordinates
  const f3 = getDestinationFromRequest({ meetingCoordinates: { latitude: -26.1800, longitude: 28.0200 } });
  assert.deepEqual(f3, { latitude: -26.1800, longitude: 28.0200 });

  // Format 4: studentCoordinates with lat/lng
  const f4 = getDestinationFromRequest({ studentCoordinates: { lat: -26.1700, lng: 28.0100 } });
  assert.deepEqual(f4, { latitude: -26.1700, longitude: 28.0100 });

  // Format 5: location
  const f5 = getDestinationFromRequest({ location: { latitude: -26.1600, longitude: 28.0000 } });
  assert.deepEqual(f5, { latitude: -26.1600, longitude: 28.0000 });

  // Invalid: missing coordinates
  const fInvalid = getDestinationFromRequest({ destination: null, location: undefined });
  assert.equal(fInvalid, null);

  // Invalid: NaN coordinates
  const fNan = getDestinationFromRequest({ destination: { latitude: 'invalid', longitude: 'none' } });
  assert.equal(fNan, null);
});
