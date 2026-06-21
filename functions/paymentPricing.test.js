const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBookingFeePricing,
  ensureMinimumCancellationCharge,
  grossUpForPaystack,
} = require('./paymentPricing');

test('grosses up small amounts with percentage-only Paystack fee', () => {
  const result = grossUpForPaystack(5);

  assert.equal(result.feeRule, 'percentage_only');
  assert.equal(result.totalZar, 5.2);
  assert.equal(result.paystackFeeZar, 0.2);
});

test('grosses up larger amounts with fixed plus percentage Paystack fee', () => {
  const result = grossUpForPaystack(20);

  assert.equal(result.feeRule, 'fixed_plus_percentage');
  assert.equal(result.totalZar, 21.85);
  assert.equal(result.paystackFeeZar, 1.85);
});

test('builds booking fee from OCR, Gemini, buffer, and Paystack fee', () => {
  const result = buildBookingFeePricing({
    cloudVisionZar: 4,
    geminiZar: 2,
  });

  assert.equal(result.subtotalZar, 6);
  assert.equal(result.bufferAmountZar, 0.6);
  assert.equal(result.processingSubtotalZar, 6.6);
  assert.equal(result.paystackFeeRule, 'percentage_only');
  assert.equal(result.paystackFeeZar, 0.27);
  assert.equal(result.totalZar, 6.87);
});

test('adds the R1 surcharge when cancellation charge is below R1', () => {
  assert.equal(ensureMinimumCancellationCharge(0.47), 1.47);
  assert.equal(ensureMinimumCancellationCharge(1.2), 1.2);
});
