import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { PaymentMethodsManager } from '../../components/student/PaymentMethodsManager';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentWallet } from '../../services/walletService';
import { colors } from '../../theme/colors';

export function WalletScreen() {
  const { setUser, user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => subscribeToStudentWallet(user?.uid, setWallet, (nextError) => setError(nextError.message)), [user?.uid]);

  if (error) return <ErrorState message={error} />;
  if (!wallet) return <LoadingState label="Loading payment" />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Payment</Text>
      <Card>
        <Text style={styles.balance}>{wallet.currency || 'ZAR'} {Number(wallet.balance || 0).toFixed(2)}</Text>
        <Text style={styles.copy}>Saved cards are available now. Wallet top-ups and debt handling continue in Phase 6.</Text>
      </Card>
      {message ? <Card><Text style={styles.copy}>{message}</Text></Card> : null}
      <PaymentMethodsManager user={user} setUser={setUser} onMessage={setMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  balance: {
    color: colors.brandDark,
    fontSize: 30,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 8,
  },
});
