import { getFirebaseClients } from '../firebase/config';
import { normalizePricingSnapshot } from '../utils/pricing';
import { debugLog } from '../utils/devLogger';

export async function fetchPricingQuote({ durationMinutes, subject }) {
  const clients = await getFirebaseClients();
  if (!clients?.auth?.currentUser) {
    throw new Error('You must be signed in to request a pricing quote.');
  }

  const idToken = await clients.auth.currentUser.getIdToken();
  const response = await fetch('/pricing-quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ durationMinutes, subject }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || !payload?.quote) {
    throw new Error(payload?.message || 'Unable to fetch pricing quote right now.');
  }

  const quote = normalizePricingSnapshot(payload.quote);
  debugLog('pricingService', 'Received backend pricing quote.', {
    quoteId: quote.quoteId,
    durationMinutes: quote.durationMinutes,
    totalAmount: quote.totalAmount,
    pricingBand: quote.pricingBand,
    configVersion: quote.configVersion,
  });
  return quote;
}
