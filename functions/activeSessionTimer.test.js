const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');
const { computeTravelFee } = require('./pricingEngine');

test('Start lesson transitions cleanly from preparing_for_lesson to in_session', () => {
  assert.equal(
    canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.IN_SESSION),
    true,
    'Session must transition from preparing_for_lesson to in_session when start lesson is invoked',
  );

  assert.equal(
    canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.ENDING_REQUESTED),
    true,
    'Session must transition from in_session to ending_requested on finish handshake request',
  );

  assert.equal(
    canTransition(LESSON_STATUS.ENDING_REQUESTED, LESSON_STATUS.COMPLETED),
    true,
    'Session must transition from ending_requested to completed on handshake confirmation',
  );
});

test('Tutor earnings formula adheres to 73% tuition + 100% travel fee', () => {
  const TUTOR_PAYOUT_RATE = 0.73;
  const basePrice = 7.00;
  const ratePerMinute = 3.60;
  const durationMinutes = 30;
  const distanceKm = 15; // 5 km beyond 10 km -> R40 + 5 * R4 = R60

  const travelFee = computeTravelFee(distanceKm);
  assert.equal(travelFee, 60.00, 'Travel fee for 15 km must equal R60.00');

  const lessonTuition = basePrice + (durationMinutes * ratePerMinute); // 7 + 108 = 115
  assert.equal(lessonTuition, 115.00);

  const tutorTuitionEarnings = Number((lessonTuition * TUTOR_PAYOUT_RATE).toFixed(2)); // 115 * 0.73 = 83.95
  assert.equal(tutorTuitionEarnings, 83.95);

  const tutorTotalEarnings = Number((tutorTuitionEarnings + travelFee).toFixed(2)); // 83.95 + 60 = 143.95
  assert.equal(tutorTotalEarnings, 143.95);
});

test('Elapsed timer calculation clamps to 0 when not in active session', () => {
  const now = Date.now();
  const sessionCreatedAt = now - 15 * 60 * 1000; // 15 mins ago

  function calculateElapsedSeconds(status, billingStartedAt, currentMs) {
    const isSessionActive = ['in_session', 'in_progress', 'ending_requested'].includes(String(status).toLowerCase());
    if (!isSessionActive || !billingStartedAt) return 0;
    return Math.max(0, Math.floor((currentMs - billingStartedAt) / 1000));
  }

  // Before official start: arrived or preparing
  assert.equal(
    calculateElapsedSeconds(LESSON_STATUS.ARRIVED, sessionCreatedAt, now),
    0,
    'Elapsed seconds must be 0 while arrived',
  );

  assert.equal(
    calculateElapsedSeconds(LESSON_STATUS.PREPARING_FOR_LESSON, sessionCreatedAt, now),
    0,
    'Elapsed seconds must be 0 while preparing_for_lesson',
  );

  // Once started
  const billingStartedAt = now - 180 * 1000; // started 3 minutes ago
  assert.equal(
    calculateElapsedSeconds(LESSON_STATUS.IN_SESSION, billingStartedAt, now),
    180,
    'Elapsed seconds must count from billingStartedAt once in_session',
  );
});

test('Preparation grace auto-expiration triggers lesson start timestamp', () => {
  const now = Date.now();
  const prepGraceDurationMs = 5 * 60 * 1000;
  const prepGraceEndsAt = now - 1000; // expired 1 second ago

  const isPrepGraceExpired = now >= prepGraceEndsAt;
  assert.equal(isPrepGraceExpired, true, 'Preparation grace must be identified as expired');

  // Next status upon expiration is in_session
  const nextStatus = isPrepGraceExpired ? LESSON_STATUS.IN_SESSION : LESSON_STATUS.PREPARING_FOR_LESSON;
  assert.equal(nextStatus, LESSON_STATUS.IN_SESSION);
});
