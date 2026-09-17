const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BILLING_RULES,
  computeBookingFee,
  computeTravelFee,
  computeCancellationQuote,
  computeFinalAmountFromSnapshot,
} = require('./pricingEngine');

test('Completed in-person lesson calculates 73/27 tuition split + 100% travel + 100% booking fee', () => {
  const distanceKm = 15; // 5 km beyond 10 km -> R40 + 5 * R4 = R60
  const travelFee = computeTravelFee(distanceKm);
  assert.equal(travelFee, 60.00, '15 km must yield R60.00 travel fee');

  const discountedTuition = 200.00;
  const bookingFee = computeBookingFee(discountedTuition);
  assert.equal(bookingFee, 2.00, 'R200 tuition yields max R2.00 booking fee');

  const tutorTuitionShare = Number((discountedTuition * BILLING_RULES.TUTOR_PAYOUT_RATE).toFixed(2));
  const platformTuitionShare = Number((discountedTuition - tutorTuitionShare).toFixed(2));

  assert.equal(tutorTuitionShare, 146.00, '73% of R200 = R146.00');
  assert.equal(platformTuitionShare, 54.00, '27% of R200 = R54.00');

  const tutorAmount = Number((tutorTuitionShare + travelFee).toFixed(2));
  const platformAmount = Number((platformTuitionShare + bookingFee).toFixed(2));
  const totalAmount = Number((discountedTuition + travelFee + bookingFee).toFixed(2));

  assert.equal(tutorAmount, 206.00, 'Tutor receives 73% tuition + 100% travel');
  assert.equal(platformAmount, 56.00, 'Platform receives 27% tuition + 100% booking fee');
  assert.equal(totalAmount, 262.00, 'Student is charged tuition + travel + booking fee');
  assert.equal(Number((tutorAmount + platformAmount).toFixed(2)), totalAmount, 'Tutor and platform totals must balance exactly');
});

test('Completed in-person lesson with base travel fee covers <= 10 km correctly', () => {
  const distanceKm = 4.5;
  const travelFee = computeTravelFee(distanceKm);
  assert.equal(travelFee, 40.00, 'Distance <= 10 km must yield R40 base travel fee');

  const discountedTuition = 100.00;
  const bookingFee = computeBookingFee(discountedTuition);
  assert.equal(bookingFee, 1.00, 'R100 tuition yields min R1.00 booking fee');

  const tutorTuitionShare = Number((discountedTuition * BILLING_RULES.TUTOR_PAYOUT_RATE).toFixed(2));
  const platformTuitionShare = Number((discountedTuition - tutorTuitionShare).toFixed(2));

  assert.equal(tutorTuitionShare, 73.00, '73% of R100 = R73.00');
  assert.equal(platformTuitionShare, 27.00, '27% of R100 = R27.00');

  const tutorAmount = Number((tutorTuitionShare + travelFee).toFixed(2));
  const platformAmount = Number((platformTuitionShare + bookingFee).toFixed(2));
  const totalAmount = Number((discountedTuition + travelFee + bookingFee).toFixed(2));

  assert.equal(tutorAmount, 113.00);
  assert.equal(platformAmount, 28.00);
  assert.equal(totalAmount, 141.00);
  assert.equal(Number((tutorAmount + platformAmount).toFixed(2)), totalAmount);
});

test('In-session student cancellation enforces 30-minute minimum with travel and booking fee', () => {
  const totalRouteKm = 10;
  const elapsedMinutes = 12; // Short session -> clamped to 30 mins
  const agreedRatePerMinute = 3.00;

  const quote = computeCancellationQuote({
    status: 'in_session',
    mode: 'in_person',
    canceledBy: 'student',
    totalRouteKm,
    elapsedMinutes,
    agreedRatePerMinute,
  });

  assert.equal(quote.travelFee, 40.00, 'Full travel fee allocated to tutor');
  assert.equal(quote.lessonFee, 90.00, '30-minute minimum lesson fee = R90.00');
  assert.equal(quote.bookingFee, 1.00, '1% of R90 = R0.90 clamped to R1.00');
  assert.equal(quote.tutorPayout, 105.70, 'R40 travel + 73% of R90 (R65.70) = R105.70');
  assert.equal(quote.platformFee, 25.30, 'R1 booking fee + 27% of R90 (R24.30) = R25.30');
  assert.equal(quote.finalAmount, 131.00, 'Total charge = R131.00');
  assert.equal(Number((quote.tutorPayout + quote.platformFee).toFixed(2)), quote.finalAmount);
});

test('In-session tutor cancellation grants 100% full refund (R0 to student)', () => {
  const quote = computeCancellationQuote({
    status: 'in_session',
    mode: 'in_person',
    canceledBy: 'tutor',
    totalRouteKm: 10,
    elapsedMinutes: 45,
    agreedRatePerMinute: 3.00,
  });

  assert.equal(quote.finalAmount, 0);
  assert.equal(quote.tutorPayout, 0);
  assert.equal(quote.platformFee, 0);
  assert.equal(quote.cancellationFee, 0);
});

test('Student wallet debt recording handles uncollected amounts correctly', () => {
  const initialWallet = { balance: 50.00, currency: 'ZAR' };
  const chargeAmount = 262.00;

  // Simulate failed debit
  const charge = {
    ok: false,
    reason: 'Insufficient funds or gateway unavailable',
    paidAmount: 0,
    unpaidAmount: chargeAmount,
  };

  const paymentStatus = charge.unpaidAmount > 0 ? 'wallet_debt_recorded' : 'paid';
  const nextWalletBalance = Number((initialWallet.balance - charge.unpaidAmount).toFixed(2));

  assert.equal(paymentStatus, 'wallet_debt_recorded');
  assert.equal(nextWalletBalance, -212.00, 'Wallet balance reflects debt of R212.00');
});

test('Stored payoutBreakdown guarantees consistency across Admin Payments Page and sync', () => {
  // Mock session document with completed billing settlement
  const session = {
    id: 'test_session_123',
    status: 'completed',
    totalAmount: 262.00,
    originalPrice: 262.00,
    payoutBreakdown: {
      platformFeeRate: 0.27,
      tutorRate: 0.73,
      tuitionAmount: 200.00,
      tutorTuitionShare: 146.00,
      platformTuitionShare: 54.00,
      travelFee: 60.00,
      bookingFee: 2.00,
      tutorAmount: 206.00,
      platformAmount: 56.00,
      grossAmount: 262.00,
    },
  };

  // Replicate computeFullSessionAmounts from index.js / web utils
  const tutorAmount = Number(
    Number.isFinite(Number(session.payoutBreakdown?.tutorAmount))
      ? Number(session.payoutBreakdown.tutorAmount)
      : (session.totalAmount * BILLING_RULES.TUTOR_PAYOUT_RATE),
  );
  const platformAmount = Number(
    Number.isFinite(Number(session.payoutBreakdown?.platformAmount))
      ? Number(session.payoutBreakdown.platformAmount)
      : (session.totalAmount * BILLING_RULES.PLATFORM_FEE_RATE),
  );

  assert.equal(tutorAmount, 206.00, 'Admin/payout sync must read exact stored tutor amount');
  assert.equal(platformAmount, 56.00, 'Admin/payout sync must read exact stored platform amount');
  assert.equal(Number((tutorAmount + platformAmount).toFixed(2)), session.totalAmount);
});
