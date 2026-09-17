export const REQUEST_STATUS = {
  PENDING: 'pending',
  MATCHING: 'matching',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  IN_SESSION: 'in_session',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  CANCELED_DURING: 'canceled_during',
  EXPIRED: 'expired',
  NO_TUTOR_AVAILABLE: 'no_tutor_available',
};

export const SESSION_STATUS = {
  WAITING_STUDENT: 'waiting_student',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  CANCELED_DURING: 'canceled_during',
};

export const OFFER_TIMEOUT_SECONDS = 30;
export const OFFER_TIMEOUT_MS = OFFER_TIMEOUT_SECONDS * 1000;

export function normalizeOfferExpiresAt(value) {
  if (!value) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value?.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value?.toDate === 'function') {
    const millis = value.toDate().getTime();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
    return Number.isFinite(millis) ? millis : null;
  }

  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  WALLET_DEBT_RECORDED: 'wallet_debt_recorded',
  FAILED: 'failed',
};
