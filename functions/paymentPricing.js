function toMoney(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Number(numeric.toFixed(6));
}

function toRand(value) {
  return Number(toMoney(value).toFixed(2));
}

const PAYSTACK_PERCENT_RATE = 0.039;
const PAYSTACK_FIXED_FEE_ZAR = 1;
const PAYSTACK_FIXED_FEE_THRESHOLD_ZAR = 10;
const BOOKING_FEE_BUFFER_RATE = 0.10;
const MINIMUM_CANCELLATION_SURCHARGE_ZAR = 1;

function grossUpForPaystack(baseAmount = 0) {
  const safeBaseAmount = toRand(baseAmount);
  if (!safeBaseAmount) {
    return {
      baseAmount: 0,
      paystackFeeZar: 0,
      totalZar: 0,
      feeRule: 'none',
    };
  }

  const percentageOnlyTotal = toRand(safeBaseAmount / (1 - PAYSTACK_PERCENT_RATE));
  if (percentageOnlyTotal <= PAYSTACK_FIXED_FEE_THRESHOLD_ZAR) {
    return {
      baseAmount: safeBaseAmount,
      paystackFeeZar: toRand(percentageOnlyTotal - safeBaseAmount),
      totalZar: percentageOnlyTotal,
      feeRule: 'percentage_only',
    };
  }

  const fixedPlusPercentageTotal = toRand(
    (safeBaseAmount + PAYSTACK_FIXED_FEE_ZAR) / (1 - PAYSTACK_PERCENT_RATE),
  );

  return {
    baseAmount: safeBaseAmount,
    paystackFeeZar: toRand(fixedPlusPercentageTotal - safeBaseAmount),
    totalZar: fixedPlusPercentageTotal,
    feeRule: 'fixed_plus_percentage',
  };
}

function buildBookingFeePricing({
  cloudVisionZar = 0,
  geminiZar = 0,
  bufferRate = BOOKING_FEE_BUFFER_RATE,
} = {}) {
  const cloudVisionAmount = toRand(cloudVisionZar);
  const geminiAmount = toRand(geminiZar);
  const subtotalZar = toRand(cloudVisionAmount + geminiAmount);
  const bufferAmountZar = toRand(subtotalZar * Number(bufferRate || 0));
  const processingSubtotalZar = toRand(subtotalZar + bufferAmountZar);
  const paystackCharge = grossUpForPaystack(processingSubtotalZar);

  return {
    currency: 'ZAR',
    bookingFeeLabel: 'booking_fee',
    cloudVisionZar: cloudVisionAmount,
    geminiZar: geminiAmount,
    subtotalZar,
    bufferRate: Number(bufferRate || 0),
    bufferAmountZar,
    processingSubtotalZar,
    paystackFeeRate: PAYSTACK_PERCENT_RATE,
    paystackFixedFeeZar: PAYSTACK_FIXED_FEE_ZAR,
    paystackFeeThresholdZar: PAYSTACK_FIXED_FEE_THRESHOLD_ZAR,
    paystackFeeRule: paystackCharge.feeRule,
    paystackFeeZar: paystackCharge.paystackFeeZar,
    totalZar: paystackCharge.totalZar,
  };
}

function ensureMinimumCancellationCharge(totalAmount = 0, minimumSurchargeZar = MINIMUM_CANCELLATION_SURCHARGE_ZAR) {
  const safeTotalAmount = toRand(totalAmount);
  const safeMinimumSurcharge = toRand(minimumSurchargeZar);

  if (!safeTotalAmount || safeTotalAmount >= safeMinimumSurcharge) {
    return safeTotalAmount;
  }

  return toRand(safeTotalAmount + safeMinimumSurcharge);
}

module.exports = {
  BOOKING_FEE_BUFFER_RATE,
  MINIMUM_CANCELLATION_SURCHARGE_ZAR,
  PAYSTACK_PERCENT_RATE,
  PAYSTACK_FIXED_FEE_ZAR,
  PAYSTACK_FIXED_FEE_THRESHOLD_ZAR,
  buildBookingFeePricing,
  ensureMinimumCancellationCharge,
  grossUpForPaystack,
};
