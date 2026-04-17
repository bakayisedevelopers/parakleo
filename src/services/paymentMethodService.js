import { updateUserProfile } from './userService';

export async function addPaymentMethod(user, { nickname, paystackAuthorization }) {
  const nextMethod = {
    id: crypto.randomUUID(),
    nickname: nickname?.trim() || 'My Card',
    brand: paystackAuthorization.brand || 'Card',
    last4: paystackAuthorization.last4,
    paystackAuthorizationCode: paystackAuthorization.authorization_code,
    isDefault: (user?.paymentMethods || []).length === 0,
    createdAt: new Date().toISOString(),
  };

  const existing = sanitizeMethods(user?.paymentMethods || []);
  const paymentMethods = [...existing, nextMethod];

  return updateUserProfile(user.uid, { paymentMethods });
}

export async function setDefaultPaymentMethod(user, methodId) {
  const paymentMethods = sanitizeMethods((user?.paymentMethods || []).map((method) => ({
    ...method,
    isDefault: method.id === methodId,
  })));

  return updateUserProfile(user.uid, { paymentMethods });
}

export async function removePaymentMethod(user, methodId) {
  const existing = sanitizeMethods((user?.paymentMethods || []).filter((method) => method.id !== methodId));

  if (existing.length && !existing.some((method) => method.isDefault)) {
    existing[0].isDefault = true;
  }

  return updateUserProfile(user.uid, { paymentMethods: existing });
}
