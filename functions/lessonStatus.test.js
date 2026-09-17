const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const backendStatus = require('./lessonStatus');
const {
  LESSON_STATUS,
  TERMINAL_STATUSES,
  ACTIVE_LESSON_STATUSES,
  TRAVEL_LIFECYCLE_STATUSES,
  ACTIVE_TRACKING_STATUSES,
  CANCELLATION_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  isTerminalStatus,
  isActiveLessonStatus,
  isTravelLifecycleStatus,
  isActiveTrackingStatus,
  isCancellationStatus,
} = backendStatus;

test('LESSON_STATUS defines all 18 canonical in-person lifecycle statuses', () => {
  const expectedKeys = [
    'PENDING',
    'MATCHING',
    'OFFERED',
    'ACCEPTED',
    'TRAVELLING',
    'ARRIVED',
    'WAITING_STUDENT',
    'PREPARING_FOR_LESSON',
    'IN_SESSION',
    'IN_PROGRESS',
    'ENDING_REQUESTED',
    'COMPLETED',
    'SETTLED',
    'CANCELED',
    'CANCELED_DURING',
    'CANCELED_BY_STUDENT',
    'CANCELED_BY_TUTOR',
    'EXPIRED',
  ];

  assert.equal(Object.keys(LESSON_STATUS).length, 18);
  for (const key of expectedKeys) {
    assert.ok(LESSON_STATUS[key], `Missing status key ${key}`);
    assert.equal(typeof LESSON_STATUS[key], 'string');
    assert.equal(LESSON_STATUS[key], LESSON_STATUS[key].toLowerCase());
  }
});

test('TERMINAL_STATUSES contains completed, settled, cancellations, and expired', () => {
  const expected = [
    'completed',
    'settled',
    'canceled',
    'canceled_during',
    'canceled_by_student',
    'canceled_by_tutor',
    'expired',
  ];
  assert.deepEqual([...TERMINAL_STATUSES].sort(), [...expected].sort());
  for (const st of expected) {
    assert.equal(isTerminalStatus(st), true);
    assert.equal(isTerminalStatus(st.toUpperCase()), true);
  }
  assert.equal(isTerminalStatus('in_session'), false);
  assert.equal(isTerminalStatus('travelling'), false);
  assert.equal(isTerminalStatus(null), false);
  assert.equal(isTerminalStatus(undefined), false);
});

test('ACTIVE_LESSON_STATUSES contains in_session, in_progress, and ending_requested', () => {
  const expected = ['in_session', 'in_progress', 'ending_requested'];
  assert.deepEqual([...ACTIVE_LESSON_STATUSES].sort(), [...expected].sort());
  for (const st of expected) {
    assert.equal(isActiveLessonStatus(st), true);
    assert.equal(isActiveLessonStatus(st.toUpperCase()), true);
  }
  assert.equal(isActiveLessonStatus('accepted'), false);
  assert.equal(isActiveLessonStatus('completed'), false);
  assert.equal(isActiveLessonStatus(''), false);
});

test('ACTIVE_TRACKING_STATUSES and TRAVEL_LIFECYCLE_STATUSES match identically', () => {
  const expected = [
    'accepted',
    'travelling',
    'arrived',
    'waiting_student',
    'preparing_for_lesson',
  ];
  assert.deepEqual([...ACTIVE_TRACKING_STATUSES].sort(), [...expected].sort());
  assert.deepEqual([...TRAVEL_LIFECYCLE_STATUSES].sort(), [...expected].sort());

  for (const st of expected) {
    assert.equal(isActiveTrackingStatus(st), true);
    assert.equal(isActiveTrackingStatus(st.toUpperCase()), true);
    assert.equal(isTravelLifecycleStatus(st), true);
    assert.equal(isTravelLifecycleStatus(st.toUpperCase()), true);
  }
  assert.equal(isActiveTrackingStatus('in_session'), false);
  assert.equal(isActiveTrackingStatus('pending'), false);
  assert.equal(isActiveTrackingStatus(null), false);
});

test('CANCELLATION_STATUSES contains all cancellation variants', () => {
  const expected = [
    'canceled',
    'canceled_during',
    'canceled_by_student',
    'canceled_by_tutor',
  ];
  assert.deepEqual([...CANCELLATION_STATUSES].sort(), [...expected].sort());
  for (const st of expected) {
    assert.equal(isCancellationStatus(st), true);
    assert.equal(isCancellationStatus(st.toUpperCase()), true);
  }
  assert.equal(isCancellationStatus('expired'), false);
  assert.equal(isCancellationStatus('completed'), false);
  assert.equal(isCancellationStatus(undefined), false);
});

test('canTransition validates standard forward journey from pending to settled', () => {
  const journey = [
    LESSON_STATUS.PENDING,
    LESSON_STATUS.MATCHING,
    LESSON_STATUS.OFFERED,
    LESSON_STATUS.ACCEPTED,
    LESSON_STATUS.TRAVELLING,
    LESSON_STATUS.ARRIVED,
    LESSON_STATUS.WAITING_STUDENT,
    LESSON_STATUS.PREPARING_FOR_LESSON,
    LESSON_STATUS.IN_SESSION,
    LESSON_STATUS.ENDING_REQUESTED,
    LESSON_STATUS.COMPLETED,
    LESSON_STATUS.SETTLED,
  ];

  for (let i = 0; i < journey.length - 1; i++) {
    const from = journey[i];
    const to = journey[i + 1];
    assert.equal(canTransition(from, to), true, `Expected valid transition from ${from} to ${to}`);
  }
});

test('canTransition supports synonym in_progress and direct shortcuts', () => {
  // Arrived direct to in_session
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.IN_SESSION), true);
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.IN_PROGRESS), true);

  // Preparing direct to in_session
  assert.equal(canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.IN_SESSION), true);
  assert.equal(canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.IN_PROGRESS), true);

  // in_progress transitions like in_session
  assert.equal(canTransition(LESSON_STATUS.IN_PROGRESS, LESSON_STATUS.ENDING_REQUESTED), true);
  assert.equal(canTransition(LESSON_STATUS.IN_PROGRESS, LESSON_STATUS.COMPLETED), true);
  assert.equal(canTransition(LESSON_STATUS.IN_PROGRESS, LESSON_STATUS.SETTLED), true);

  // Ending requested can resume in_session if needed
  assert.equal(canTransition(LESSON_STATUS.ENDING_REQUESTED, LESSON_STATUS.IN_SESSION), true);
});

test('canTransition allows idempotent and case-insensitive transitions', () => {
  assert.equal(canTransition('ACCEPTED', 'accepted'), true);
  assert.equal(canTransition('TRAVELLING', 'travelling'), true);
  assert.equal(canTransition('IN_SESSION', 'in_session'), true);
  assert.equal(canTransition('TRAVELLING', 'ARRIVED'), true);
  assert.equal(canTransition('travelling', 'ARRIVED'), true);
});

test('canTransition rejects invalid or backwards transitions', () => {
  // Illegal jumps
  assert.equal(canTransition(LESSON_STATUS.PENDING, LESSON_STATUS.IN_SESSION), false);
  assert.equal(canTransition(LESSON_STATUS.ACCEPTED, LESSON_STATUS.COMPLETED), false);
  assert.equal(canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.PENDING), false);
  assert.equal(canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.MATCHING), false);

  // Terminal states cannot transition to active states
  assert.equal(canTransition(LESSON_STATUS.SETTLED, LESSON_STATUS.IN_SESSION), false);
  assert.equal(canTransition(LESSON_STATUS.CANCELED, LESSON_STATUS.ACCEPTED), false);
  assert.equal(canTransition(LESSON_STATUS.CANCELED_BY_STUDENT, LESSON_STATUS.TRAVELLING), false);
  assert.equal(canTransition(LESSON_STATUS.CANCELED_BY_TUTOR, LESSON_STATUS.TRAVELLING), false);
  assert.equal(canTransition(LESSON_STATUS.EXPIRED, LESSON_STATUS.MATCHING), false);

  // Falsy inputs
  assert.equal(canTransition(null, LESSON_STATUS.ACCEPTED), false);
  assert.equal(canTransition(LESSON_STATUS.ACCEPTED, null), false);
  assert.equal(canTransition('', ''), false);
});

test('canTransition allows stage-appropriate cancellations', () => {
  // Pre-acceptance cancellation
  assert.equal(canTransition(LESSON_STATUS.PENDING, LESSON_STATUS.CANCELED_BY_STUDENT), true);
  assert.equal(canTransition(LESSON_STATUS.PENDING, LESSON_STATUS.CANCELED), true);
  assert.equal(canTransition(LESSON_STATUS.PENDING, LESSON_STATUS.EXPIRED), true);

  assert.equal(canTransition(LESSON_STATUS.MATCHING, LESSON_STATUS.CANCELED_BY_STUDENT), true);
  assert.equal(canTransition(LESSON_STATUS.OFFERED, LESSON_STATUS.CANCELED_BY_TUTOR), true);

  // Travel lifecycle cancellations by student or tutor
  const travelStates = [
    LESSON_STATUS.ACCEPTED,
    LESSON_STATUS.TRAVELLING,
    LESSON_STATUS.ARRIVED,
    LESSON_STATUS.WAITING_STUDENT,
    LESSON_STATUS.PREPARING_FOR_LESSON,
  ];

  for (const st of travelStates) {
    assert.equal(canTransition(st, LESSON_STATUS.CANCELED_BY_STUDENT), true, `Failed for ${st} student cancel`);
    assert.equal(canTransition(st, LESSON_STATUS.CANCELED_BY_TUTOR), true, `Failed for ${st} tutor cancel`);
    assert.equal(canTransition(st, LESSON_STATUS.CANCELED), true, `Failed for ${st} generic cancel`);
  }

  // In-session cancellations
  assert.equal(canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.CANCELED_DURING), true);
  assert.equal(canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.CANCELED_BY_STUDENT), true);
  assert.equal(canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.CANCELED_BY_TUTOR), true);
  assert.equal(canTransition(LESSON_STATUS.IN_SESSION, LESSON_STATUS.CANCELED), true);
});

test('Cross-application parity: functions, mobile, and tutors match identically', async () => {
  const mobilePath = path.resolve(__dirname, '../mobile/src/constants/lessonStatus.js');
  const tutorsPath = path.resolve(__dirname, '../tutors/src/constants/lessonStatus.js');

  const mobileStatus = await import(pathToFileURL(mobilePath).href);
  const tutorsStatus = await import(pathToFileURL(tutorsPath).href);

  // 1. LESSON_STATUS enum match
  assert.deepEqual(mobileStatus.LESSON_STATUS, backendStatus.LESSON_STATUS);
  assert.deepEqual(tutorsStatus.LESSON_STATUS, backendStatus.LESSON_STATUS);

  // 2. TERMINAL_STATUSES array match
  assert.deepEqual(mobileStatus.TERMINAL_STATUSES, backendStatus.TERMINAL_STATUSES);
  assert.deepEqual(tutorsStatus.TERMINAL_STATUSES, backendStatus.TERMINAL_STATUSES);

  // 3. ACTIVE_LESSON_STATUSES array match
  assert.deepEqual(mobileStatus.ACTIVE_LESSON_STATUSES, backendStatus.ACTIVE_LESSON_STATUSES);
  assert.deepEqual(tutorsStatus.ACTIVE_LESSON_STATUSES, backendStatus.ACTIVE_LESSON_STATUSES);

  // 4. ACTIVE_TRACKING_STATUSES array match
  assert.deepEqual(mobileStatus.ACTIVE_TRACKING_STATUSES, backendStatus.ACTIVE_TRACKING_STATUSES);
  assert.deepEqual(tutorsStatus.ACTIVE_TRACKING_STATUSES, backendStatus.ACTIVE_TRACKING_STATUSES);

  // 5. TRAVEL_LIFECYCLE_STATUSES array match
  assert.deepEqual(mobileStatus.TRAVEL_LIFECYCLE_STATUSES, backendStatus.TRAVEL_LIFECYCLE_STATUSES);
  assert.deepEqual(tutorsStatus.TRAVEL_LIFECYCLE_STATUSES, backendStatus.TRAVEL_LIFECYCLE_STATUSES);

  // 6. CANCELLATION_STATUSES array match
  assert.deepEqual(mobileStatus.CANCELLATION_STATUSES, backendStatus.CANCELLATION_STATUSES);
  assert.deepEqual(tutorsStatus.CANCELLATION_STATUSES, backendStatus.CANCELLATION_STATUSES);

  // 7. ALLOWED_TRANSITIONS map match
  assert.deepEqual(mobileStatus.ALLOWED_TRANSITIONS, backendStatus.ALLOWED_TRANSITIONS);
  assert.deepEqual(tutorsStatus.ALLOWED_TRANSITIONS, backendStatus.ALLOWED_TRANSITIONS);

  // 8. canTransition behaviour match
  const testPairs = [
    ['pending', 'matching', true],
    ['matching', 'offered', true],
    ['offered', 'accepted', true],
    ['accepted', 'travelling', true],
    ['travelling', 'arrived', true],
    ['arrived', 'waiting_student', true],
    ['waiting_student', 'preparing_for_lesson', true],
    ['preparing_for_lesson', 'in_session', true],
    ['in_session', 'ending_requested', true],
    ['ending_requested', 'completed', true],
    ['completed', 'settled', true],
    ['accepted', 'completed', false],
    ['in_session', 'matching', false],
    ['settled', 'accepted', false],
    ['accepted', 'canceled_by_student', true],
    ['travelling', 'canceled_by_tutor', true],
  ];

  for (const [from, to, expectedResult] of testPairs) {
    assert.equal(mobileStatus.canTransition(from, to), expectedResult, `Mobile canTransition(${from}, ${to}) failed`);
    assert.equal(tutorsStatus.canTransition(from, to), expectedResult, `Tutors canTransition(${from}, ${to}) failed`);
    assert.equal(backendStatus.canTransition(from, to), expectedResult, `Backend canTransition(${from}, ${to}) failed`);
  }

  // 9. Status check helper behavior match
  for (const st of Object.values(LESSON_STATUS)) {
    assert.equal(mobileStatus.isTerminalStatus(st), backendStatus.isTerminalStatus(st));
    assert.equal(tutorsStatus.isTerminalStatus(st), backendStatus.isTerminalStatus(st));

    assert.equal(mobileStatus.isActiveLessonStatus(st), backendStatus.isActiveLessonStatus(st));
    assert.equal(tutorsStatus.isActiveLessonStatus(st), backendStatus.isActiveLessonStatus(st));

    assert.equal(mobileStatus.isTravelLifecycleStatus(st), backendStatus.isTravelLifecycleStatus(st));
    assert.equal(tutorsStatus.isTravelLifecycleStatus(st), backendStatus.isTravelLifecycleStatus(st));

    assert.equal(mobileStatus.isActiveTrackingStatus(st), backendStatus.isActiveTrackingStatus(st));
    assert.equal(tutorsStatus.isActiveTrackingStatus(st), backendStatus.isActiveTrackingStatus(st));

    assert.equal(mobileStatus.isCancellationStatus(st), backendStatus.isCancellationStatus(st));
    assert.equal(tutorsStatus.isCancellationStatus(st), backendStatus.isCancellationStatus(st));
  }
});
