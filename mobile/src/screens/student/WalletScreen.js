import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PaystackAuthorizationModal } from '../../components/student/PaystackAuthorizationModal';
import { NotificationsButton } from '../../components/navigation/NotificationsButton';
import { useAuth } from '../../context/AuthContext';
import { removePaymentMethod, setDefaultPaymentMethod } from '../../services/paymentMethodService';
import { verifyCardAuthorization } from '../../services/paystackService';
import { syncStudentGrowth } from '../../services/studentGrowthService';
import { subscribeToStudentWallet } from '../../services/walletService';

function CardBrandBadge({ brand = '', size = 'small' }) {
  const normalized = String(brand || '').toLowerCase();
  const isVisa = normalized.includes('visa');
  const isMastercard = normalized.includes('master');
  const isCash = normalized === 'cash';

  if (isCash) {
    return (
      <View style={[styles.brandBadge, styles.brandCash, size === 'large' && styles.brandBadgeLarge]}>
        <Ionicons name="cash" size={size === 'large' ? 18 : 14} color="#ffffff" />
      </View>
    );
  }

  if (isVisa) {
    return (
      <View style={[styles.brandBadge, styles.brandVisa, size === 'large' && styles.brandBadgeLarge]}>
        <Text style={[styles.brandTextVisa, size === 'large' && styles.brandTextVisaLarge]}>VISA</Text>
      </View>
    );
  }

  if (isMastercard) {
    return (
      <View style={[styles.brandBadge, styles.brandMastercard, size === 'large' && styles.brandBadgeLarge]}>
        <View style={styles.mcCircleLeft} />
        <View style={styles.mcCircleRight} />
      </View>
    );
  }

  return (
    <View style={[styles.brandBadge, styles.brandGeneric, size === 'large' && styles.brandBadgeLarge]}>
      <Ionicons name="card" size={size === 'large' ? 16 : 13} color="#ffffff" />
    </View>
  );
}

export function WalletScreen({ navigate, goBack, unreadCount = 0 }) {
  const { setUser, user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isAuthorizingCard, setIsAuthorizingCard] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [isWhatIsBalanceOpen, setIsWhatIsBalanceOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);

  const walletBalance = Number(wallet?.balance || 0);
  const paymentMethods = useMemo(() => Array.isArray(user?.paymentMethods) ? user.paymentMethods : [], [user?.paymentMethods]);

  // Sync selected method with default or fallback to cash
  useEffect(() => {
    const defaultCard = paymentMethods.find((card) => card.isDefault);
    if (defaultCard) {
      setSelectedMethodId(defaultCard.id);
    } else if (paymentMethods.length > 0) {
      setSelectedMethodId(paymentMethods[0].id);
    } else {
      setSelectedMethodId('cash');
    }
  }, [paymentMethods]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToStudentWallet(
      user.uid,
      setWallet,
      (nextError) => setError(nextError.message || 'Unable to load wallet.'),
    );
  }, [user?.uid]);

  function handleClose() {
    if (goBack) {
      goBack('Dashboard');
    } else if (navigate) {
      navigate('Dashboard');
    }
  }

  async function syncGrowthState() {
    const syncedProfile = await syncStudentGrowth().catch(() => null);
    if (syncedProfile) {
      setUser((prev) => ({ ...prev, ...syncedProfile }));
    }
  }

  async function handleSelectMethod(methodId) {
    setSelectedMethodId(methodId);
    if (methodId === 'cash') {
      // Unset default on cards so cash is active
      const updated = paymentMethods.map((m) => ({ ...m, isDefault: false }));
      setUser((prev) => ({ ...prev, paymentMethods: updated }));
      setMessage('Cash selected as payment method.');
      return;
    }

    try {
      const next = await setDefaultPaymentMethod(user, methodId);
      setUser((prev) => ({ ...prev, ...next }));
      await syncGrowthState();
      setMessage('Primary card updated.');
    } catch (_err) {
      setMessage('Unable to set primary card.');
    }
  }

  async function handleRemoveCard(cardId) {
    try {
      const next = await removePaymentMethod(user, cardId);
      setUser((prev) => ({ ...prev, ...next }));
      await syncGrowthState();
      setMessage('Card removed.');
    } catch (_err) {
      setMessage('Unable to remove card.');
    }
  }

  async function handleAuthorizationSuccess(response) {
    setIsAuthorizingCard(false);
    setMessage('Card authorized. Verifying and saving it now...');
    try {
      const result = await verifyCardAuthorization(response.reference, {
        userId: user.uid,
      });
      setUser((prev) => {
        const existing = Array.isArray(prev?.paymentMethods) ? prev.paymentMethods : [];
        const alreadyExists = existing.some((method) => method.id === result.card.id);
        return {
          ...prev,
          paymentMethods: alreadyExists ? existing : [...existing, result.card],
        };
      });
      await syncGrowthState();
      setMessage(
        result.refunded
          ? `Card ending in ${result.card.last4} added successfully. Your R1 authorization was refunded.`
          : `Card ending in ${result.card.last4} was added.`,
      );
    } catch (err) {
      setMessage(err.message || 'We could not verify this card. Please try again.');
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />
      <SafeAreaView style={styles.safeContainer}>
        {/* Top Header with Back Button and Notifications */}
        <View style={styles.topHeader}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <NotificationsButton
            navigate={navigate}
            unreadCount={unreadCount}
          />
        </View>

        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          {/* Title */}
          <Text style={styles.screenTitle}>Payment</Text>

        {/* Balance Card with Pastel Mint Background */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceAmount}>R {walletBalance.toFixed(0)}</Text>
        </View>

        {/* Informational Action Links */}
        <View style={styles.linksContainer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsWhatIsBalanceOpen(true)}
            style={styles.linkRow}
          >
            <Ionicons name="help-circle-outline" size={22} color="#4b5563" />
            <Text style={styles.linkText}>What is balance?</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setIsTransactionsOpen(true)}
            style={styles.linkRow}
          >
            <Ionicons name="time-outline" size={22} color="#4b5563" />
            <Text style={styles.linkText}>See balance transactions</Text>
          </Pressable>
        </View>

        {/* Subtle Divider */}
        <View style={styles.divider} />

        {/* Payment Methods Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Payment methods</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsEditMode((curr) => !curr)}
            style={styles.editButton}
          >
            <Text style={styles.editText}>{isEditMode ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>

        {/* Notification Feedback Message */}
        {message ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Payment Methods List */}
        <View style={styles.methodsList}>
          {/* Saved Cards */}
          {paymentMethods.map((card) => {
            const isSelected = selectedMethodId === card.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={card.id}
                onPress={() => handleSelectMethod(card.id)}
                style={styles.methodRow}
              >
                <View style={styles.methodLeft}>
                  <CardBrandBadge brand={card.brand} size="large" />
                  <Text style={styles.cardNumberText}>•••• {card.last4 || '----'}</Text>
                </View>

                {isEditMode ? (
                  <Pressable
                    accessibilityLabel="Delete card"
                    accessibilityRole="button"
                    onPress={() => handleRemoveCard(card.id)}
                    style={styles.deleteCardButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#e11d48" />
                  </Pressable>
                ) : (
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Cash Option at the bottom */}
          <Pressable
            accessibilityRole="button"
            onPress={() => handleSelectMethod('cash')}
            style={styles.methodRow}
          >
            <View style={styles.methodLeft}>
              <CardBrandBadge brand="Cash" size="large" />
              <Text style={styles.cardNumberText}>Cash</Text>
            </View>

            <View style={[styles.radioOuter, selectedMethodId === 'cash' && styles.radioOuterSelected]}>
              {selectedMethodId === 'cash' ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>
        </View>

        {/* Add Payment Method Button */}
        <Pressable
          accessibilityRole="button"
          disabled={isAuthorizingCard}
          onPress={() => setIsAuthorizingCard(true)}
          style={styles.addPaymentButton}
        >
          <Ionicons name="add-circle-outline" size={22} color="#059669" />
          <Text style={styles.addPaymentText}>
            {isAuthorizingCard ? 'Authorizing card...' : 'Add payment method'}
          </Text>
        </Pressable>

        <Text style={styles.addHint}>
          We charge R1 to securely authorize your card, then immediately refund it.
        </Text>
      </ScrollView>
    </SafeAreaView>

      {/* Paystack Authorization Modal */}
      <PaystackAuthorizationModal
        email={user?.email}
        onClose={() => setIsAuthorizingCard(false)}
        onError={(err) => {
          setIsAuthorizingCard(false);
          setMessage(`Payment initialization failed: ${err.message}`);
        }}
        onSuccess={handleAuthorizationSuccess}
        visible={isAuthorizingCard}
      />

      {/* What is Balance Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isWhatIsBalanceOpen}
        onRequestClose={() => setIsWhatIsBalanceOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.scrim} onPress={() => setIsWhatIsBalanceOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalSheetTitle}>What is balance?</Text>
            <Text style={styles.modalSheetBody}>
              Your Parakleo balance reflects prepaid credits, lesson refunds, referral bonuses, or outstanding lesson balances.
            </Text>
            <Text style={styles.modalSheetBody}>
              When you have a positive balance, it is automatically applied to cover your in-person and online class bookings.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsWhatIsBalanceOpen(false)}
              style={styles.modalDismissButton}
            >
              <Text style={styles.modalDismissText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Transactions Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isTransactionsOpen}
        onRequestClose={() => setIsTransactionsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.scrim} onPress={() => setIsTransactionsOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalSheetTitle}>Balance Transactions</Text>
            <Text style={styles.modalSheetSubtitle}>Recent activity on your Parakleo balance</Text>

            <View style={styles.emptyTransactionsWrap}>
              <Ionicons name="receipt-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyTransactionsText}>No balance transactions yet.</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsTransactionsOpen(false)}
              style={styles.modalDismissButton}
            >
              <Text style={styles.modalDismissText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f0fdf4',
    flex: 1,
  },
  safeContainer: {
    backgroundColor: '#f0fdf4',
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 12,
  },
  topHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  container: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  screenTitle: {
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
    marginTop: 8,
  },
  balanceCard: {
    backgroundColor: '#dff7ee',
    borderColor: '#bbf7d0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  balanceLabel: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '500',
  },
  balanceAmount: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  linksContainer: {
    gap: 16,
    marginTop: 20,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  linkText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    backgroundColor: '#f1f5f9',
    height: 1,
    marginVertical: 24,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  editButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  editText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 6,
    padding: 12,
  },
  feedbackText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 6,
    padding: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  methodsList: {
    marginTop: 8,
  },
  methodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  methodLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  cardNumberText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '600',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioOuterSelected: {
    borderColor: '#059669',
  },
  radioInner: {
    backgroundColor: '#059669',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  deleteCardButton: {
    padding: 4,
  },
  addPaymentButton: {
    alignItems: 'center',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
  },
  addPaymentText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '700',
  },
  addHint: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  brandBadge: {
    alignItems: 'center',
    borderRadius: 5,
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 28,
  },
  brandBadgeLarge: {
    borderRadius: 6,
    height: 24,
    width: 38,
  },
  brandCash: {
    backgroundColor: '#059669',
  },
  brandVisa: {
    backgroundColor: '#1d4ed8',
  },
  brandTextVisa: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTextVisaLarge: {
    fontSize: 11,
  },
  brandMastercard: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
  },
  mcCircleLeft: {
    backgroundColor: '#ef4444',
    borderRadius: 5,
    height: 10,
    marginRight: -3,
    width: 10,
  },
  mcCircleRight: {
    backgroundColor: '#f59e0b',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  brandGeneric: {
    backgroundColor: '#475569',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  modalGrabber: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    height: 4,
    marginBottom: 16,
    width: 38,
  },
  modalSheetTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  modalSheetSubtitle: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  modalSheetBody: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  emptyTransactionsWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyTransactionsText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  modalDismissButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    marginTop: 16,
  },
  modalDismissText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
