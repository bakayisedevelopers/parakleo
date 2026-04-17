import { useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import SelectField from '../../../components/ui/SelectField';
import FormField from '../../../components/ui/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { addMoneyToWallet, getOutstandingAmount } from '../../../services/walletService';
import PaymentMethodsManager from '../../../components/app/PaymentMethodsManager';

export default function StudentWalletPage() {
  const { user, setUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState(user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const walletBalance = Number(user?.wallet?.balance || 0);
  const outstanding = getOutstandingAmount(user?.wallet);

  const topUp = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      setIsLoading(true);
      const result = await addMoneyToWallet({ user, amount: Number(amount), cardId });

      setUser((prev) => ({ ...prev, ...result.profile }));
      setMessage(`Wallet funded successfully. Txn: ${result.charge.transactionId}`);
      setAmount('');
    } catch (error) {
      setMessage(error.message || 'Unable to add money right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment" description="Manage your wallet and payment methods in one place." />

      <SectionCard title="Wallet balance">
        <p className={`text-3xl font-black ${walletBalance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>R{walletBalance.toFixed(2)}</p>
        {outstanding > 0 ? (
          <p className="mt-2 text-sm text-amber-700">Outstanding debt: R{outstanding.toFixed(2)}. Add funds to clear the balance.</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">No outstanding debt.</p>
        )}
      </SectionCard>

      <SectionCard title="Add money to wallet" subtitle="Charge your selected card and credit your wallet.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={topUp}>
          <FormField label="Amount (R)" name="amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <SelectField
            label="Payment Card"
            name="cardId"
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
            options={(user?.paymentMethods || []).map((card) => ({
              value: card.id,
              label: `${card.nickname.charAt(0).toUpperCase() + card.nickname.slice(1)} ${card.isDefault ? ' (Primary)' : ''}`,
            }))}
          />
          <div className="md:col-span-2">
            <button type="submit" disabled={isLoading} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {isLoading ? 'Processing...' : 'Add funds'}
            </button>
          </div>
          {message ? <p className="md:col-span-2 text-sm text-zinc-700">{message}</p> : null}
        </form>
      </SectionCard>

      <SectionCard title="Payment cards">
        <PaymentMethodsManager user={user} setUser={setUser} onMessage={setMessage} />
      </SectionCard>
    </div>
  );
}
