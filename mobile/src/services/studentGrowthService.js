import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';

export async function syncStudentGrowth() {
  const { auth } = getFirebaseClients();
  const token = await auth.currentUser?.getIdToken();
  if (!token) return null;

  const response = await fetch(getFunctionEndpoint('syncStudentGrowth'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Unable to sync student growth status right now.');
  }

  return payload?.profile || null;
}
