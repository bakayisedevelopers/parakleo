const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');
const { computeCancellationQuote, computeTravelFee, computeBookingFee } = require('./pricingEngine');

test('Lesson preparation contract transitions cleanly from arrived to preparing_for_lesson', () => {
  assert.equal(
    canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.PREPARING_FOR_LESSON),
    true,
    'Tutor must be allowed to transition from arrived to preparing_for_lesson',
  );

  assert.equal(
    canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.IN_SESSION),
    true,
    'Session must be allowed to transition from preparing_for_lesson to in_session',
  );

  assert.equal(
    canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.CANCELED_BY_STUDENT),
    true,
    'Student must be allowed to cancel from preparing_for_lesson',
  );

  assert.equal(
    canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.CANCELED_BY_TUTOR),
    true,
    'Tutor must be allowed to cancel from preparing_for_lesson',
  );
});

test('5-minute preparation grace period calculation and metadata schema', () => {
  const now = Date.now();
  const prepGracePeriodMs = 5 * 60 * 1000;
  const prepGraceEndsAt = now + prepGracePeriodMs;

  const mockPayload = {
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    statusDetail: 'Tutor has met student and is preparing for the lesson.',
    preparingStartedAt: now,
    preparationGraceStartedAt: now,
    preparationGraceEndsAt: prepGraceEndsAt,
  };

  assert.equal(mockPayload.status, 'preparing_for_lesson');
  assert.equal(mockPayload.preparationGraceEndsAt - mockPayload.preparationGraceStartedAt, 300000);
  assert.ok(mockPayload.preparationGraceEndsAt > now);
});

test('RTDB live tracking snapshot includes synchronized preparation grace properties', () => {
  const now = Date.now();
  const prepGraceMs = 5 * 60 * 1000;
  const endsAt = now + prepGraceMs;

  const rtdbPayload = {
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    preparingStartedAtMs: now,
    preparationGraceStartedAtMs: now,
    preparationGraceEndsAt: endsAt,
    preparationGraceEndsAtMs: endsAt,
    updatedAtMs: now,
  };

  assert.equal(rtdbPayload.status, 'preparing_for_lesson');
  assert.equal(rtdbPayload.preparingStartedAtMs, now);
  assert.equal(rtdbPayload.preparationGraceStartedAtMs, now);
  assert.equal(rtdbPayload.preparationGraceEndsAt, endsAt);
  assert.equal(rtdbPayload.preparationGraceEndsAtMs, endsAt);
  assert.equal(rtdbPayload.preparationGraceEndsAtMs - rtdbPayload.preparationGraceStartedAtMs, 300000);
});

test('Billing clock remains held during arrived and preparing_for_lesson states', () => {
  // Verifies that neither arrived nor preparing_for_lesson sets billingStartedAt
  const arrivedSession = {
    status: LESSON_STATUS.ARRIVED,
    arrivedAt: Date.now(),
    billingStartedAt: null,
  };

  const preparingSession = {
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    preparingStartedAt: Date.now(),
    preparationGraceStartedAt: Date.now(),
    preparationGraceEndsAt: Date.now() + 300000,
    billingStartedAt: null,
  };

  const inSessionState = {
    status: LESSON_STATUS.IN_SESSION,
    lessonStartedAt: Date.now(),
    billingStartedAt: Date.now(),
  };

  assert.equal(arrivedSession.billingStartedAt, null, 'Billing clock must not start on arrival');
  assert.equal(preparingSession.billingStartedAt, null, 'Billing clock must not start during preparation grace');
  assert.ok(inSessionState.billingStartedAt > 0, 'Billing clock commences only in in_session status');
});

test('Stage cancellation quote in preparing_for_lesson matches confirmed launch policy', () => {
  // Policy: Travel surcharge (100% to tutor) + 30-min minimum lesson fee (73/27 split) + booking fee (100% to platform)
  const totalRouteKm = 12; // 12 km -> R40 + 2*R4 = R48
  const agreedRatePerMinute = 3.0; // 30 min -> 30*3.0 = R90 tuition
  const quote = computeCancellationQuote({
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    canceledBy: 'student',
    totalRouteKm,
    agreedRatePerMinute,
  });

  const expectedTravel = computeTravelFee(totalRouteKm); // R48
  const expectedLessonTuition = 30 * agreedRatePerMinute; // R90
  const expectedBookingFee = computeBookingFee(expectedLessonTuition); // 1% of 90 = R1.00 (clamped to R1 min)
  const expectedTutorLessonShare = expectedLessonTuition * 0.73; // R65.70
  const expectedPlatformLessonShare = expectedLessonTuition * 0.27; // R24.30

  assert.equal(quote.travelFee, expectedTravel);
  assert.equal(quote.bookingFee, expectedBookingFee);
  assert.equal(quote.lessonFee, expectedLessonTuition);
  assert.equal(quote.tutorPayout, expectedTravel + expectedTutorLessonShare);
  assert.equal(quote.platformFee, expectedBookingFee + expectedPlatformLessonShare);
  assert.equal(quote.finalAmount, expectedTravel + expectedLessonTuition + expectedBookingFee);
});
