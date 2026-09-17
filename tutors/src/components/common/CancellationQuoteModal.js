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

const TUTOR_CANCELLATION_REASONS = [
  'Vehicle breakdown / Transport emergency',
  'Severe traffic / Road closure',
  'Student not at location / Unreachable',
  'Safety concern at meeting venue',
  'Personal or family emergency',
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
  userRole = 'tutor',
}) {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [selectedReason, setSelectedReason] = useState(TUTOR_CANCELLATION_REASONS[0]);
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
            <View style={[styles.alertIconBadge, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="alert-circle" size={24} color="#dc2626" />
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>Cancel Tutoring Request</Text>
              <Text style={styles.headerSubtitle}>Tutor cancellation policy</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Loading policy...</Text>
              </View>
            ) : (
              <>
                {/* Notice box */}
                <View style={styles.policyCard}>
                  <Ionicons name="information-circle" size={20} color="#0f766e" />
                  <View style={styles.policyTextWrap}>
                    <Text style={styles.policyTitle}>Tutor Cancellation Rule</Text>
                    <Text style={styles.policySubtitle}>
                      When a tutor cancels, the student is billed R0.00 and the tutor receives R0.00 payout. Please only cancel when strictly necessary.
                    </Text>
                  </View>
                </View>

                {/* Reason picker */}
                <Text style={styles.sectionTitle}>Cancellation Reason</Text>
                {TUTOR_CANCELLATION_REASONS.map((r) => {
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
                    placeholder="Please explain the situation..."
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
  policyCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 10,
    alignItems: 'flex-start',
  },
  policyTextWrap: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  policySubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 3,
    lineHeight: 16,
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
