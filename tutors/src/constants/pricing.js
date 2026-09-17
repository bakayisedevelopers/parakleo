export const TUTOR_PAYOUT_RATE = 0.73;
export const PLATFORM_FEE_RATE = 0.27;
export const DEFAULT_CURRENCY = 'ZAR';

export const BASE_TRAVEL_FEE = 40.00;
export const TRAVEL_FEE_PER_KM_AFTER_10 = 4.00;

export function computeTravelFee(distanceKm = 0) {
  const km = Math.max(0, Number(distanceKm || 0));
  const baseFee = 40.00;
  const extraKm = Math.max(0, km - 10);
  const extraFee = extraKm * 4.00;
  return Number((Math.round(((baseFee + extraFee) + Number.EPSILON) * 100) / 100).toFixed(2));
}

export function computeBookingFee(lessonTuitionAmount = 0) {
  const tuition = Number(lessonTuitionAmount || 0);
  if (tuition <= 0) return 0;
  const rawFee = Number((Math.round(((tuition * 0.01) + Number.EPSILON) * 100) / 100).toFixed(2));
  return Number((Math.min(2.00, Math.max(1.00, rawFee))).toFixed(2));
}

export function formatCurrency(amount = 0) {
  const numeric = Number(amount || 0);
  return `R ${numeric.toFixed(2)}`;
}

export function calculateTutorOfferPayout({ pricingSnapshot = {}, durationMinutes = 10, mode = 'in_person', travelDistanceKm = 0 } = {}) {
  const duration = Math.max(1, Number(durationMinutes || pricingSnapshot.durationMinutes || 10));
  const basePrice = Number(pricingSnapshot.adjustedBaseAmount ?? pricingSnapshot.baseAmount ?? 7);
  const ratePerMinute = Number(pricingSnapshot.adjustedRatePerMinute ?? pricingSnapshot.ratePerMinute ?? 3.6);
  const lessonTuition = Number(
    pricingSnapshot.lessonTuitionAmount
    ?? pricingSnapshot.rawLessonCost
    ?? (basePrice + (duration * ratePerMinute))
  );
  const isInPerson = mode === 'in_person';
  const travelFee = isInPerson
    ? Number(pricingSnapshot.transferFee ?? pricingSnapshot.travelFee ?? computeTravelFee(travelDistanceKm))
    : 0;
  const tutorLessonShare = Number((lessonTuition * TUTOR_PAYOUT_RATE).toFixed(2));
  const totalTutorEarnings = Number((tutorLessonShare + travelFee).toFixed(2));

  return {
    lessonTuition,
    tutorLessonShare,
    travelFee,
    totalTutorEarnings,
    currency: DEFAULT_CURRENCY,
  };
}
