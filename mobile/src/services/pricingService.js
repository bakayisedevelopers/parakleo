import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';
import { LEGACY_SAFE_PRICING_SNAPSHOT, normalizePricingSnapshot } from '../utils/pricing';

const PRICING_QUOTE_ENDPOINT = getFunctionEndpoint('getPricingQuote');
const PRICING_QUOTE_TIMEOUT_MS = 4000;
const PRICING_TOKEN_TIMEOUT_MS = 3000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function fetchPricingQuote({ durationMinutes, subject }) {
  const clients = getFirebaseClients();
  if (!clients?.auth?.currentUser) {
    return normalizePricingSnapshot(LEGACY_SAFE_PRICING_SNAPSHOT);
  }

  const idToken = await withTimeout(
    clients.auth.currentUser.getIdToken(),
    PRICING_TOKEN_TIMEOUT_MS,
    'Pricing authorization timed out.'
  );
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), PRICING_QUOTE_TIMEOUT_MS) : null;

  try {
    const response = await withTimeout(
      fetch(PRICING_QUOTE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ durationMinutes, subject }),
        signal: controller?.signal,
      }),
      PRICING_QUOTE_TIMEOUT_MS,
      'Pricing quote timed out.'
    );

    const payload = await withTimeout(
      response.json().catch(() => ({})),
      PRICING_QUOTE_TIMEOUT_MS,
      'Pricing response timed out.'
    );
    if (!response.ok || !payload?.success || !payload?.quote) {
      throw new Error(payload?.message || 'Unable to fetch pricing quote right now.');
    }

    return normalizePricingSnapshot(payload.quote);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
