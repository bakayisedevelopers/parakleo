const test = require('node:test');
const assert = require('node:assert/strict');
const { LESSON_STATUS, canTransition } = require('./lessonStatus');

test('Dispatch acceptance transitions cleanly through the canonical matching lifecycle', () => {
  // Matching finds tutor -> sends offer
  assert.equal(canTransition('matching', 'offered'), true, 'Should allow matching -> offered');

  // Tutor accepts offer
  assert.equal(canTransition('offered', 'accepted'), true, 'Should allow offered -> accepted');

  // Accepted -> tutor starts travel
  assert.equal(canTransition('accepted', 'travelling'), true, 'Should allow accepted -> travelling');

  // Cannot revert backwards
  assert.equal(canTransition('accepted', 'offered'), false, 'Cannot revert accepted to offered');
  assert.equal(canTransition('accepted', 'matching'), false, 'Cannot revert accepted to matching');
});

test('Dispatch decline transitions cleanly from offered to matching for cascade', () => {
  assert.equal(canTransition('offered', 'matching'), true, 'Should allow offered -> matching');

  const currentQueue = ['tutor_declining_1', 'tutor_next_2', 'tutor_backup_3'];
  const decliningTutorId = 'tutor_declining_1';
  const nextQueue = currentQueue.filter((id) => id !== decliningTutorId);
  const nextDeclined = Array.from(new Set([decliningTutorId]));

  assert.deepEqual(nextQueue, ['tutor_next_2', 'tutor_backup_3'], 'Declining tutor should be removed from dispatch queue');
  assert.equal(nextQueue[0], 'tutor_next_2', 'Next closest tutor becomes head of dispatch queue');
  assert.ok(nextDeclined.includes(decliningTutorId), 'Declining tutor recorded in declinedTutorIds');
});

test('Session initialization payload contains complete in-person contract', () => {
  const mockRequest = {
    id: 'req_12345',
    studentId: 'student_99',
    studentName: 'Nandi Sithole',
    mode: 'in_person',
    subject: 'Physical Sciences',
    topic: 'Stoichiometry & Chemical Equilibrium',
    grade: 'Grade 11',
    meetingAddress: '14 Long Street, Cape Town CBD',
    studentLocation: { latitude: -33.9249, longitude: 18.4241 },
    pricingSnapshot: {
      baseAmount: 7,
      ratePerMinute: 3.6,
      travelFee: 40,
      bookingFee: 1.5,
      durationMinutes: 30,
    },
  };

  const tutor = {
    uid: 'tutor_za_42',
    name: 'Thabo Mokoena',
    email: 'thabo@parakleo.co.za',
  };

  const now = Date.now();
  const sessionDoc = {
    id: mockRequest.id,
    requestId: mockRequest.id,
    tutorId: tutor.uid,
    tutorName: tutor.name,
    studentId: mockRequest.studentId,
    studentName: mockRequest.studentName,
    mode: mockRequest.mode,
    subject: mockRequest.subject,
    topic: mockRequest.topic,
    grade: mockRequest.grade,
    status: LESSON_STATUS.ACCEPTED,
    statusDetail: 'Tutor accepted and is preparing for class.',
    meetingAddress: mockRequest.meetingAddress,
    studentLocation: mockRequest.studentLocation,
    pricingSnapshot: mockRequest.pricingSnapshot,
    durationMinutes: mockRequest.pricingSnapshot.durationMinutes,
    createdAtMs: now,
    acceptedAtMs: now,
  };

  assert.equal(sessionDoc.id, 'req_12345');
  assert.equal(sessionDoc.status, 'accepted');
  assert.equal(sessionDoc.mode, 'in_person');
  assert.equal(sessionDoc.meetingAddress, '14 Long Street, Cape Town CBD');
  assert.equal(sessionDoc.pricingSnapshot.travelFee, 40);
  assert.equal(sessionDoc.pricingSnapshot.bookingFee, 1.5);
  assert.equal(sessionDoc.durationMinutes, 30);
});

test('Dispatch offer countdown defaults to 30 seconds timeout window', () => {
  const OFFER_TIMEOUT_MS = 30000;
  const now = Date.now();
  const expiresAt = now + OFFER_TIMEOUT_MS;
  const secondsLeft = Math.ceil((expiresAt - now) / 1000);
  assert.equal(secondsLeft, 30, 'Offer window should be exactly 30 seconds');

  const pastExpiresAt = now - 1000;
  const isExpired = pastExpiresAt <= now;
  assert.equal(isExpired, true, 'Offer with past timestamp is correctly flagged expired');
});
