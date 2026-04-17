import { getUserProfile, updateUserProfile } from './userService';
import { fundWalletWithCard } from './paymentGatewayService';

function normalizeWallet(wallet = {}) {
  return {
    balance: Number(wallet.balance || 0),
    currency: wallet.currency || 'ZAR',
    updatedAt: wallet.updatedAt || new Date().toISOString(),
  };
}

export function getOutstandingAmount(wallet = {}) {
  const balance = Number(wallet.balance || 0);
  return balance < 0 ? Number(Math.abs(balance).toFixed(2)) : 0;
}

export async function applyWalletDebt(userId, amount) {
  const profile = await getUserProfile(userId);
  const wallet = normalizeWallet(profile?.wallet);
  const nextBalance = Number((wallet.balance - amount).toFixed(2));

  return updateUserProfile(userId, {
    wallet: {
      ...wallet,
      balance: nextBalance,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function addMoneyToWallet({ user, amount, cardId }) {
  const targetAmount = Number(amount || 0);
  if (!targetAmount || targetAmount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  const card = (user?.paymentMethods || []).find((item) => item.id === cardId)
    || (user?.paymentMethods || []).find((item) => item.isDefault)
    || user?.paymentMethods?.[0];

  const charge = await fundWalletWithCard({ amount: targetAmount, card });

  if (!charge.ok) {
    throw new Error('Wallet top-up failed. Please check your card and try again.');
  }

  const wallet = normalizeWallet(user?.wallet);
  const nextBalance = Number((wallet.balance + targetAmount).toFixed(2));

  const profile = await updateUserProfile(user.uid, {
    wallet: {
      ...wallet,
      balance: nextBalance,
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    profile,
    charge,
  };
}
