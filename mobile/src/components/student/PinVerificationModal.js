import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verifyMeetingPin } from '../../services/sessionService';

export function PinVerificationModal({
  visible,
  onClose,
  onSuccess,
  requestId,
  sessionId,
  tutorName = 'your tutor',
}) {
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
      setIsSubmitting(false);
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible]);

  const handleVerify = async (codeToVerify) => {
    const entered = String(codeToVerify || pin).trim();
    if (entered.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setIsSubmitting(true);
    setError('');
    Keyboard.dismiss();

    try {
      const result = await verifyMeetingPin({
        requestId,
        sessionId,
        enteredPin: entered,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess?.(result);
        onClose?.();
      }, 900);
    } catch (err) {
      setError(err.message || 'Incorrect meeting PIN');
      if (err.attemptsRemaining !== undefined) {
        setAttemptsRemaining(err.attemptsRemaining);
      }
      setPin('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(cleaned);
    setError('');
    if (cleaned.length === 4) {
      handleVerify(cleaned);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={isSuccess ? 'checkmark-circle' : 'keypad'}
                size={28}
                color={isSuccess ? '#059669' : '#047857'}
              />
            </View>
            <Text style={styles.title}>
              {isSuccess ? 'Meeting Confirmed!' : 'Verify Meeting PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {isSuccess
                ? 'Your in-person tutoring session is ready to begin.'
                : `Enter the 4-digit PIN shown on ${tutorName}'s screen to verify arrival.`}
            </Text>
          </View>

          {isSuccess ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-done-circle" size={48} color="#059669" />
              <Text style={styles.successTitle}>Verified In-Person</Text>
              <Text style={styles.successSub}>Starting 5-minute preparation grace window...</Text>
            </View>
          ) : (
            <>
              {/* 4-Digit Box Container */}
              <Pressable
                style={styles.pinBoxesRow}
                onPress={() => inputRef.current?.focus()}
              >
                {[0, 1, 2, 3].map((index) => {
                  const digit = pin[index] || '';
                  const isFocused = pin.length === index;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.pinBox,
                        isFocused && styles.pinBoxFocused,
                        digit && styles.pinBoxFilled,
                        error && styles.pinBoxError,
                      ]}
                    >
                      <Text style={styles.pinBoxText}>{digit}</Text>
                    </View>
                  );
                })}
              </Pressable>

              {/* Hidden Real TextInput */}
              <TextInput
                ref={inputRef}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.hiddenInput}
                autoFocus
                caretHidden
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : (
                <Text style={styles.attemptsHint}>
                  {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                </Text>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  disabled={isSubmitting}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleVerify(pin)}
                  disabled={pin.length !== 4 || isSubmitting}
                  style={[
                    styles.verifyButton,
                    (pin.length !== 4 || isSubmitting) && styles.buttonDisabled,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.verifyButtonText}>Verify Meeting</Text>
                      <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  pinBox: {
    width: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFocused: {
    borderColor: '#059669',
    backgroundColor: '#ffffff',
  },
  pinBoxFilled: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  pinBoxError: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  pinBoxText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
  },
  attemptsHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  verifyButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
  },
  successSub: {
    fontSize: 12,
    color: '#047857',
    textAlign: 'center',
  },
});
