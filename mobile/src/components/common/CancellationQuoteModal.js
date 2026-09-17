import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCancellationQuote } from '../../services/sessionService';

const CANCELLATION_REASONS = [
  'Change of plans / No longer needed',
  'Tutor is taking too long to arrive',
  'Personal or family emergency',
  'Incorrect meeting address or subject',
  'Safety or security concern',
  'Other reason',
];

export function CancellationQuoteModal({
  visible,
  onClose,
  onConfirmCancel,
  requestId,
  sessionId,
  currentStatus = 'accepted',
  distanceTravelledKm = 0,
  totalRouteKm = 10,
  estimatedAmount = 100,
  elapsedMinutes = 0,
  agreedRatePerMinute = 3.0,
  userRole = 'student',
}) {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let isActive = true;
    setLoading(true);

    getCancellationQuote({
      requestId,
      sessionId,
      canceledBy: userRole,
      distanceTravelledKm,
      totalRouteKm,
      estimatedAmount,
      elapsedMinutes,
      agreedRatePerMinute,
      status: currentStatus,
    })
      .then((q) => {
        if (isActive) {
          setQuote(q);
          setLoading(false);
        }
      })
      .catch((_err) => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    agreedRatePerMinute,
    currentStatus,
    distanceTravelledKm,
    elapsedMinutes,
    estimatedAmount,
    requestId,
    sessionId,
    totalRouteKm,
    userRole,
    visible,
  ]);

  const finalReason = selectedReason === 'Other reason' ? (customReason.trim() || 'Other reason') : selectedReason;
  const chargeAmount = Number(quote?.cancellationCharge || 0);
  const isFree = chargeAmount <= 0;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmCancel?.({
        reason: finalReason,
        quote,
      });
      onClose?.();
    } catch (_e) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.alertIconBadge, isFree ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' }]}>
              <Ionicons
                name={isFree ? 'shield-checkmark' : 'alert-circle'}
                size={24}
                color={isFree ? '#059669' : '#dc2626'}
              />
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>Cancellation Fee Preview</Text>
              <Text style={styles.headerSubtitle}>
                {userRole === 'tutor'
                  ? 'Tutor cancellation policy'
                  : 'Review fees before confirming cancellation'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Calculating quote...</Text>
              </View>
            ) : (
              <>
                {/* Fee summary card */}
                <View style={[styles.quoteCard, isFree ? styles.quoteCardFree : styles.quoteCardCharge]}>
                  <Text style={styles.quoteCardLabel}>Cancellation Charge</Text>
                  <Text style={[styles.quoteCardAmount, isFree ? styles.quoteAmountFree : styles.quoteAmountCharge]}>
                    R{chargeAmount.toFixed(2)}
                  </Text>
                  <Text style={styles.quoteCardReason}>
                    {quote?.reason || (isFree ? 'No cancellation fee applies.' : 'Standard cancellation fees apply.')}
                  </Text>
                </View>

                {/* Breakdown items */}
                {quote?.breakdown && !isFree ? (
                  <View style={styles.breakdownBox}>
                    <Text style={styles.breakdownTitle}>Fee Breakdown</Text>
                    {quote.breakdown.bookingFee > 0 ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Booking & Processing Fee</Text>
                        <Text style={styles.breakdownValue}>R{Number(quote.breakdown.bookingFee).toFixed(2)}</Text>
                      </View>
                    ) : null}
                    {quote.breakdown.travelFee > 0 ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Tutor Travel Compensation</Text>
                        <Text style={styles.breakdownValue}>R{Number(quote.breakdown.travelFee).toFixed(2)}</Text>
                      </View>
                    ) : null}
                    {quote.breakdown.lessonFee > 0 ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Lesson Time Attended</Text>
                        <Text style={styles.breakdownValue}>R{Number(quote.breakdown.lessonFee).toFixed(2)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Reason picker */}
                <Text style={styles.sectionTitle}>Select Reason</Text>
                {CANCELLATION_REASONS.map((r) => {
                  const isSelected = selectedReason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setSelectedReason(r)}
                      style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? '#059669' : '#94a3b8'}
                      />
                      <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}>
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}

                {selectedReason === 'Other reason' ? (
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="Please tell us why you need to cancel..."
                    placeholderTextColor="#94a3b8"
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                  />
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Keep Lesson</Text>
            </Pressable>

            <Pressable
              disabled={loading || isSubmitting}
              onPress={handleConfirm}
              style={[styles.destructiveButton, (loading || isSubmitting) && styles.buttonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.destructiveButtonText}>Confirm Cancellation</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    marginBottom: 16,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  quoteCard: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  quoteCardFree: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
  },
  quoteCardCharge: {
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
  },
  quoteCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quoteCardAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
  },
  quoteAmountFree: {
    color: '#059669',
  },
  quoteAmountCharge: {
    color: '#e11d48',
  },
  quoteCardReason: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  breakdownBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  reasonOptionSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  reasonOptionText: {
    fontSize: 14,
    color: '#334155',
  },
  reasonOptionTextSelected: {
    fontWeight: '600',
    color: '#065f46',
  },
  customReasonInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 14,
    color: '#0f172a',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  destructiveButton: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
