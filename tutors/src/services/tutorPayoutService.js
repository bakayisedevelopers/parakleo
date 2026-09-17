import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';

export const FALLBACK_SOUTH_AFRICAN_BANKS = [
  { code: '470010', name: 'Capitec Bank' },
  { code: '250655', name: 'First National Bank (FNB)' },
  { code: '051001', name: 'Standard Bank' },
  { code: '198765', name: 'Nedbank' },
  { code: '632005', name: 'Absa Bank' },
  { code: '679000', name: 'Discovery Bank' },
  { code: '678910', name: 'TymeBank' },
  { code: '430000', name: 'African Bank' },
  { code: '580105', name: 'Investec Bank' },
];

export async function listTutorPayoutBanks() {
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    return FALLBACK_SOUTH_AFRICAN_BANKS;
  }

  try {
    const endpoint = getFunctionEndpoint('listTutorPayoutBanks');
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(result?.banks) && result.banks.length > 0) {
      return result.banks;
    }
  } catch (err) {
    console.warn('Using fallback bank list:', err?.message);
  }

  return FALLBACK_SOUTH_AFRICAN_BANKS;
}

export async function verifyTutorPayoutAccount(payload = {}) {
  const { auth } = getFirebaseClients();
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error('You must be signed in before verifying payout details.');
  }

  const endpoint = getFunctionEndpoint('verifyTutorPayoutAccount');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to verify payout account with bank.');
  }

  return result.payout;
}
