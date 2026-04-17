const { logger } = require('firebase-functions');

const PRICING_CONFIG_VERSION = 'pricing-v2.0.0';

const DEFAULT_PRICING_CONFIG = {
  version: PRICING_CONFIG_VERSION,
  currency: 'ZAR',
  quoteTtlSeconds: 300,
  durationAdjustment: {
    shortSessionBoostUnderMinutes: 15,
    shortSessionBoostMultiplier: 1.02,
    longSessionDiscountFromMinutes: 60,
    longSessionDiscountMultiplier: 0.97,
  },
  bands: {
    low: { base: 11, ratePerMinute: 1.65 },
    normal: { base: 12, ratePerMinute: 1.8 },
    high: { base: 14, ratePerMinute: 2.2 },
  },
  multiplierCaps: {
    min: 0.9,
    max: 1.25,
  },
  timeOfDayMultipliers: {
    overnight: 0.96,
    morning: 0.98,
    afternoon: 1.02,
    peak: 1.06,
    evening: 1.03,
  },
  demandMultipliers: {
    low: 0.97,
    normal: 1,
    high: 1.05,
  },
  availabilityMultipliers: {
    high: 0.97,
    normal: 1,
    low: 1.05,
  },
  seasonMultipliers: {
    offSeason: 0.98,
    normal: 1,
    examSeason: 1.05,
  },
  subjectMultipliers: {
    english: 1,
    languages: 1,
    general: 1,
    mathematics: 1.05,
    math: 1.05,
    science: 1.05,
    accounting: 1.05,
    'advanced mathematics': 1.1,
    'advanced math': 1.1,
    physics: 1.1,
  },
};

function roundCurrency(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function getTimeOfDayBucket(hour) {
  if (hour < 6) return 'overnight';
  if (hour < 12) return 'morning';
  if (hour < 16) return 'afternoon';
  if (hour < 20) return 'peak';
  return 'evening';
}

function getSeasonBucket(dateObj = new Date()) {
  const month = dateObj.getUTCMonth() + 1;
  if ([5, 6, 10, 11].includes(month)) return 'examSeason';
  if ([1, 7, 12].includes(month)) return 'offSeason';
  return 'normal';
}

function chooseBand({ demandLevel, availabilityLevel, timeBucket, seasonBucket }) {
  let score = 0;
  if (demandLevel === 'high') score += 1;
  if (availabilityLevel === 'low') score += 1;
  if (timeBucket === 'peak') score += 1;
  if (seasonBucket === 'examSeason') score += 1;

  if (demandLevel === 'low') score -= 1;
  if (availabilityLevel === 'high') score -= 1;

  if (score >= 2) return 'high';
  if (score <= -1) return 'low';
  return 'normal';
}

function clampMultiplier(value, caps = {}) {
  const min = Number(caps.min || 0.9);
  const max = Number(caps.max || 1.25);
  return Math.min(max, Math.max(min, Number(value || 1)));
}

function getDurationAdjustment(minutes, config) {
  const settings = config.durationAdjustment || {};
  const shortUnder = Number(settings.shortSessionBoostUnderMinutes || 15);
  const shortMultiplier = Number(settings.shortSessionBoostMultiplier || 1.02);
  const longFrom = Number(settings.longSessionDiscountFromMinutes || 60);
  const longMultiplier = Number(settings.longSessionDiscountMultiplier || 0.97);

  if (minutes < shortUnder) {
    return { multiplier: shortMultiplier, label: 'short_session_adjustment' };
  }

  if (minutes >= longFrom) {
    return { multiplier: longMultiplier, label: 'long_session_discount' };
  }

  return { multiplier: 1, label: 'standard_duration' };
}

function normalizeLevel(value, allowed, fallback) {
  const next = String(value || '').trim().toLowerCase();
  return allowed.includes(next) ? next : fallback;
}

function inferDemandLevel({ activeRequests = 0, onlineTutors = 0 }) {
  if (!onlineTutors) return 'normal';
  const ratio = activeRequests / onlineTutors;
  if (ratio > 1.3) return 'high';
  if (ratio < 0.6) return 'low';
  return 'normal';
}

function inferAvailabilityLevel({ onlineTutors = 0, verifiedTutors = 0 }) {
  const ratio = verifiedTutors ? (onlineTutors / verifiedTutors) : 0;
  if (ratio > 0.5) return 'high';
  if (ratio > 0.2) return 'normal';
  return 'low';
}

function normalizeSubject(subject) {
  return String(subject || 'general').trim().toLowerCase();
}

function buildExplanationLabel({ band, timeBucket, demandLevel, availabilityLevel, seasonBucket }) {
  if (band === 'high') {
    return `High demand pricing (${timeBucket}, ${demandLevel} demand, ${availabilityLevel} availability, ${seasonBucket})`;
  }
  if (band === 'low') {
    return `Lower traffic pricing (${timeBucket}, ${demandLevel} demand, ${availabilityLevel} availability)`;
  }
  return 'Standard pricing';
}

function computePricingQuote({ minutes, subject, signalContext = {}, config = DEFAULT_PRICING_CONFIG }) {
  const duration = Math.max(1, Math.floor(Number(minutes || 0)));
  const subjectKey = normalizeSubject(subject);
  const now = signalContext.now instanceof Date ? signalContext.now : new Date();

  const timeBucket = signalContext.timeOfDayBucket || getTimeOfDayBucket(now.getHours());
  const seasonBucket = signalContext.seasonBucket || getSeasonBucket(now);
  const demandLevel = normalizeLevel(
    signalContext.demandLevel || inferDemandLevel(signalContext),
    ['low', 'normal', 'high'],
    'normal',
  );
  const availabilityLevel = normalizeLevel(
    signalContext.availabilityLevel || inferAvailabilityLevel(signalContext),
    ['low', 'normal', 'high'],
    'normal',
  );

  const band = chooseBand({ demandLevel, availabilityLevel, timeBucket, seasonBucket });
  const bandConfig = config.bands[band] || config.bands.normal;
  const subjectMultiplier = Number(config.subjectMultipliers[subjectKey] || config.subjectMultipliers.general || 1);
  const timeMultiplier = Number(config.timeOfDayMultipliers[timeBucket] || 1);
  const demandMultiplier = Number(config.demandMultipliers[demandLevel] || 1);
  const availabilityKey = availabilityLevel === 'high' ? 'high' : availabilityLevel === 'low' ? 'low' : 'normal';
  const availabilityMultiplier = Number(config.availabilityMultipliers[availabilityKey] || 1);
  const seasonMultiplier = Number(config.seasonMultipliers[seasonBucket] || 1);

  const durationAdjustment = getDurationAdjustment(duration, config);

  const combinedMultiplier = clampMultiplier(
    subjectMultiplier
    * timeMultiplier
    * demandMultiplier
    * availabilityMultiplier
    * seasonMultiplier
    * Number(durationAdjustment.multiplier || 1),
    config.multiplierCaps,
  );

  const adjustedBase = roundCurrency(Number(bandConfig.base || 0) * combinedMultiplier);
  const adjustedRate = roundCurrency(Number(bandConfig.ratePerMinute || 0) * combinedMultiplier);
  const totalAmount = roundCurrency(adjustedBase + (duration * adjustedRate));

  return {
    pricingBand: band,
    baseAmount: roundCurrency(bandConfig.base),
    ratePerMinute: roundCurrency(bandConfig.ratePerMinute),
    adjustedBaseAmount: adjustedBase,
    adjustedRatePerMinute: adjustedRate,
    durationMinutes: duration,
    subject: subjectKey,
    subjectMultiplier,
    timeOfDayBucket: timeBucket,
    timeOfDayMultiplier: timeMultiplier,
    demandLevel,
    demandMultiplier,
    availabilityLevel,
    availabilityMultiplier,
    seasonBucket,
    seasonMultiplier,
    durationAdjustment,
    combinedMultiplier,
    totalAmount,
    currency: config.currency || 'ZAR',
    configVersion: config.version || PRICING_CONFIG_VERSION,
    explanationLabel: buildExplanationLabel({
      band,
      timeBucket,
      demandLevel,
      availabilityLevel,
      seasonBucket,
    }),
  };
}

function sanitizePricingSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const totalAmount = roundCurrency(snapshot.totalAmount);
  const durationMinutes = Math.max(1, Math.floor(Number(snapshot.durationMinutes || 0)));
  const adjustedRatePerMinute = roundCurrency(snapshot.adjustedRatePerMinute || snapshot.ratePerMinute || 0);
  const adjustedBaseAmount = roundCurrency(snapshot.adjustedBaseAmount || snapshot.baseAmount || 0);

  return {
    quoteId: snapshot.quoteId || null,
    pricingBand: snapshot.pricingBand || 'normal',
    baseAmount: roundCurrency(snapshot.baseAmount || adjustedBaseAmount),
    ratePerMinute: roundCurrency(snapshot.ratePerMinute || adjustedRatePerMinute),
    adjustedBaseAmount,
    adjustedRatePerMinute,
    durationMinutes,
    subject: snapshot.subject || 'general',
    subjectMultiplier: Number(snapshot.subjectMultiplier || 1),
    timeOfDayMultiplier: Number(snapshot.timeOfDayMultiplier || 1),
    demandMultiplier: Number(snapshot.demandMultiplier || 1),
    availabilityMultiplier: Number(snapshot.availabilityMultiplier || 1),
    seasonMultiplier: Number(snapshot.seasonMultiplier || 1),
    durationAdjustment: snapshot.durationAdjustment || { multiplier: 1, label: 'legacy' },
    combinedMultiplier: Number(snapshot.combinedMultiplier || 1),
    totalAmount,
    configVersion: snapshot.configVersion || PRICING_CONFIG_VERSION,
    explanationLabel: snapshot.explanationLabel || 'Legacy pricing snapshot',
    quotedAt: snapshot.quotedAt || new Date().toISOString(),
    lockedAt: snapshot.lockedAt || new Date().toISOString(),
    lockExpiresAt: snapshot.lockExpiresAt || null,
    currency: snapshot.currency || 'ZAR',
  };
}

function computeFinalAmountFromSnapshot({
  snapshot,
  billedMinutes = 0,
  closureType = 'completed',
  selectedDurationMinutes = null,
}) {
  const safeSnapshot = sanitizePricingSnapshot(snapshot);
  const safeBilledMinutes = Math.max(0, Number(billedMinutes || 0));
  const selectedDuration = Math.max(
    1,
    Number(selectedDurationMinutes || safeSnapshot?.durationMinutes || 1),
  );
  const earlyCancelThresholdMinutes = Number((selectedDuration * 0.1).toFixed(2));
  const isCancel = closureType === 'canceled' || closureType === 'canceled_during';
  const isEarlyCancellation = isCancel && safeBilledMinutes <= earlyCancelThresholdMinutes;
  const baseAmount = roundCurrency(safeSnapshot?.adjustedBaseAmount || safeSnapshot?.baseAmount || 0);
  const perMinuteRate = roundCurrency(safeSnapshot?.adjustedRatePerMinute || safeSnapshot?.ratePerMinute || 0);

  const totalAmount = isEarlyCancellation
    ? baseAmount
    : roundCurrency(baseAmount + (safeBilledMinutes * perMinuteRate));

  return {
    totalAmount,
    perMinuteRate,
    baseAmount,
    earlyCancelThresholdMinutes,
    isEarlyCancellation,
    selectedDurationMinutes: selectedDuration,
  };
}

async function loadPricingConfig(db, fallback = DEFAULT_PRICING_CONFIG) {
  try {
    const snap = await db.collection('systemConfig').doc('pricingEngine').get();
    if (!snap.exists) return fallback;
    const data = snap.data() || {};
    return {
      ...fallback,
      ...data,
      bands: { ...fallback.bands, ...(data.bands || {}) },
      multiplierCaps: { ...fallback.multiplierCaps, ...(data.multiplierCaps || {}) },
      timeOfDayMultipliers: { ...fallback.timeOfDayMultipliers, ...(data.timeOfDayMultipliers || {}) },
      demandMultipliers: { ...fallback.demandMultipliers, ...(data.demandMultipliers || {}) },
      availabilityMultipliers: { ...fallback.availabilityMultipliers, ...(data.availabilityMultipliers || {}) },
      seasonMultipliers: { ...fallback.seasonMultipliers, ...(data.seasonMultipliers || {}) },
      subjectMultipliers: { ...fallback.subjectMultipliers, ...(data.subjectMultipliers || {}) },
      durationAdjustment: { ...fallback.durationAdjustment, ...(data.durationAdjustment || {}) },
    };
  } catch (error) {
    logger.error('Failed to load pricing config; using defaults.', { message: error.message });
    return fallback;
  }
}

module.exports = {
  DEFAULT_PRICING_CONFIG,
  PRICING_CONFIG_VERSION,
  computePricingQuote,
  loadPricingConfig,
  sanitizePricingSnapshot,
  computeFinalAmountFromSnapshot,
  roundCurrency,
};
