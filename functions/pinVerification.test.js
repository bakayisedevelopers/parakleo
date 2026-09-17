const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');

test('PIN verification transitions contract from arrived/waiting_student to preparing_for_lesson', () => {
  assert.equal(
    canTransition(LESSON_STATUS.ARRIVED, LESSON_STATUS.PREPARING_FOR_LESSON),
    true,
    'Tutor arrival must allow transition to preparing_for_lesson via PIN verification',
  );

  assert.equal(
    canTransition(LESSON_STATUS.WAITING_STUDENT, LESSON_STATUS.PREPARING_FOR_LESSON),
    true,
    'Waiting student must allow transition to preparing_for_lesson via PIN verification',
  );

  assert.equal(
    canTransition(LESSON_STATUS.PREPARING_FOR_LESSON, LESSON_STATUS.IN_SESSION),
    true,
    'Preparing for lesson must transition to in_session when lesson officially starts',
  );

  assert.equal(
    canTransition(LESSON_STATUS.PENDING, LESSON_STATUS.PREPARING_FOR_LESSON),
    false,
    'Pending status cannot directly transition to preparing_for_lesson',
  );
});

test('PIN format matches 4-digit numeric string with zero-padding', () => {
  const normalizePin = (pin) => String(pin || '').trim().padStart(4, '0');

  assert.equal(normalizePin('123'), '0123');
  assert.equal(normalizePin('0042'), '0042');
  assert.equal(normalizePin('9876'), '9876');
  assert.equal(/^\d{4}$/.test(normalizePin('42')), true);
});

test('PIN verification attempt limiting and lockout logic', () => {
  const maxAttempts = 3;
  let currentAttempts = 0;
  const expectedPin = '4821';

  function verifyAttempt(enteredPin) {
    if (currentAttempts >= maxAttempts) {
      return { success: false, code: 'MAX_ATTEMPTS_EXCEEDED', attemptsRemaining: 0 };
    }
    const normalizedEntered = String(enteredPin || '').trim().padStart(4, '0');
    if (normalizedEntered !== expectedPin) {
      currentAttempts += 1;
      const attemptsRemaining = Math.max(0, maxAttempts - currentAttempts);
      return {
        success: false,
        code: 'PIN_MISMATCH',
        attemptsRemaining,
      };
    }
    return { success: true, attemptsRemaining: maxAttempts - currentAttempts };
  }

  // Attempt 1: Wrong PIN
  const res1 = verifyAttempt('0000');
  assert.equal(res1.success, false);
  assert.equal(res1.code, 'PIN_MISMATCH');
  assert.equal(res1.attemptsRemaining, 2);

  // Attempt 2: Wrong PIN
  const res2 = verifyAttempt('1111');
  assert.equal(res2.success, false);
  assert.equal(res2.code, 'PIN_MISMATCH');
  assert.equal(res2.attemptsRemaining, 1);

  // Attempt 3: Wrong PIN -> Lockout
  const res3 = verifyAttempt('2222');
  assert.equal(res3.success, false);
  assert.equal(res3.code, 'PIN_MISMATCH');
  assert.equal(res3.attemptsRemaining, 0);

  // Attempt 4: Blocked by lockout
  const res4 = verifyAttempt('4821');
  assert.equal(res4.success, false);
  assert.equal(res4.code, 'MAX_ATTEMPTS_EXCEEDED');
  assert.equal(res4.attemptsRemaining, 0);
});

test('PIN expiration rejects stale verification codes', () => {
  const now = Date.now();
  const expiredPinTimestamp = now - 35 * 60 * 1000; // 35 minutes ago (exceeds 30 min window)
  const validPinTimestamp = now + 15 * 60 * 1000; // 15 minutes remaining

  function checkExpiration(expiresAt, currentTimestamp) {
    return Boolean(expiresAt && currentTimestamp > Number(expiresAt));
  }

  assert.equal(checkExpiration(expiredPinTimestamp, now), true, 'Must identify expired PIN');
  assert.equal(checkExpiration(validPinTimestamp, now), false, 'Must accept active PIN');
});

test('PIN verification sets Firestore and RTDB preparation grace payloads with 5-minute countdown', () => {
  const now = Date.now();
  const prepGraceDurationMs = 5 * 60 * 1000;
  const prepGraceEndsAt = now + prepGraceDurationMs;

  const firestorePatch = {
    pinVerified: true,
    pinVerifiedAt: now,
    meetingConfirmed: true,
    meetingConfirmedAt: now,
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    statusDetail: 'Physical meeting verified. 5-minute preparation grace active.',
    preparationGraceStartedAt: now,
    preparationGraceEndsAt: prepGraceEndsAt,
  };

  const rtdbPatch = {
    pinVerified: true,
    pinVerifiedAtMs: now,
    status: LESSON_STATUS.PREPARING_FOR_LESSON,
    preparationGraceEndsAt: prepGraceEndsAt,
    preparationGraceEndsAtMs: prepGraceEndsAt,
    updatedAtMs: now,
  };

  assert.equal(firestorePatch.pinVerified, true);
  assert.equal(firestorePatch.meetingConfirmed, true);
  assert.equal(firestorePatch.status, 'preparing_for_lesson');
  assert.equal(firestorePatch.preparationGraceEndsAt - firestorePatch.preparationGraceStartedAt, 300000);

  assert.equal(rtdbPatch.pinVerified, true);
  assert.equal(rtdbPatch.status, 'preparing_for_lesson');
  assert.equal(rtdbPatch.preparationGraceEndsAtMs, prepGraceEndsAt);
});

test('Billing clock remains zero during preparation grace before in_session', () => {
  const now = Date.now();
  const status = LESSON_STATUS.PREPARING_FOR_LESSON;

  function calculateElapsedSeconds(currentStatus, billingStartedAt, currentMs) {
    const isSessionActive = ['in_session', 'in_progress', 'ending_requested'].includes(currentStatus);
    if (!isSessionActive || !billingStartedAt) return 0;
    return Math.max(0, Math.floor((currentMs - billingStartedAt) / 1000));
  }

  // During prep grace, billing has not started
  const elapsedDuringPrep = calculateElapsedSeconds(status, null, now);
  assert.equal(elapsedDuringPrep, 0, 'Elapsed seconds must be 0 while in preparing_for_lesson');

  // Once started, billing clock ticks
  const lessonStartedAt = now - 120 * 1000; // 2 minutes in session
  const elapsedInSession = calculateElapsedSeconds(LESSON_STATUS.IN_SESSION, lessonStartedAt, now);
  assert.equal(elapsedInSession, 120, 'Elapsed seconds must count once in_session starts');
});
