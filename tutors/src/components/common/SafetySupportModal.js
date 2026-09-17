import React from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SafetySupportModal({
  visible,
  onClose,
  onCancelForSafety,
  userRole = 'tutor',
  currentLocationText = '',
  safetySnapshot = null,
  guardianPhone = '',
  guardianName = '',
}) {
  const resolvedGuardianPhone = guardianPhone || safetySnapshot?.guardianPhone || '';
  const resolvedGuardianName = guardianName || safetySnapshot?.guardianName || '';

  const handleCallEmergency = (number) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Unable to dial', `Please dial ${number} directly from your phone.`);
    });
  };

  const handleShareLocation = async () => {
    try {
      const guardianInfo = resolvedGuardianName ? ` Student Guardian: ${resolvedGuardianName}.` : '';
      await Share.share({
        title: 'Parakleo Safety Alert',
        message: `I am currently on an in-person Parakleo tutoring session at: ${currentLocationText || 'the student meeting location'}.${guardianInfo} Tracking active.`,
      });
    } catch (_e) {}
  };

  const handleSafetyCancelPress = () => {
    Alert.alert(
      'Cancel For Safety?',
      'If you feel uncomfortable, unsafe, or the meeting environment is hazardous, you can cancel immediately. Safety cancellations carry zero penalty.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel Immediately',
          style: 'destructive',
          onPress: () => {
            onClose?.();
            onCancelForSafety?.('Tutor safety concern');
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.shieldIconBadge}>
              <Ionicons name="shield-checkmark" size={24} color="#059669" />
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>Tutor Safety Center</Text>
              <Text style={styles.headerSubtitle}>24/7 Security & Protection</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Quick Emergency Action Cards */}
            <Text style={styles.sectionTitle}>Emergency Services (South Africa)</Text>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => handleCallEmergency('10111')}
                style={[styles.emergencyCard, { borderColor: '#ef4444' }]}
              >
                <View style={[styles.emergencyIconWrap, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="call" size={20} color="#dc2626" />
                </View>
                <Text style={styles.emergencyCardTitle}>Police 10111</Text>
                <Text style={styles.emergencyCardSub}>Flying squad</Text>
              </Pressable>

              <Pressable
                onPress={() => handleCallEmergency('112')}
                style={[styles.emergencyCard, { borderColor: '#f59e0b' }]}
              >
                <View style={[styles.emergencyIconWrap, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="medical" size={20} color="#d97706" />
                </View>
                <Text style={styles.emergencyCardTitle}>Mobile 112</Text>
                <Text style={styles.emergencyCardSub}>Any cellular network</Text>
              </Pressable>

              {resolvedGuardianPhone ? (
                <Pressable
                  onPress={() => handleCallEmergency(resolvedGuardianPhone)}
                  style={[styles.emergencyCard, { borderColor: '#10b981' }]}
                >
                  <View style={[styles.emergencyIconWrap, { backgroundColor: '#ecfdf5' }]}>
                    <Ionicons name="shield" size={20} color="#059669" />
                  </View>
                  <Text style={styles.emergencyCardTitle}>Call Guardian</Text>
                  <Text style={styles.emergencyCardSub} numberOfLines={1}>{resolvedGuardianName || 'Parent'}</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Safety Tools</Text>

            {/* Share live location button */}
            <Pressable onPress={handleShareLocation} style={styles.toolCard}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="share-social-outline" size={20} color="#059669" />
              </View>
              <View style={styles.toolTextWrap}>
                <Text style={styles.toolTitle}>Share Trip & Destination</Text>
                <Text style={styles.toolSubtitle}>Send your live lesson location to family or a friend</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>

            {/* Support helpline */}
            <Pressable onPress={() => handleCallEmergency('0800000000')} style={styles.toolCard}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="headset-outline" size={20} color="#2563eb" />
              </View>
              <View style={styles.toolTextWrap}>
                <Text style={styles.toolTitle}>Parakleo Tutor Support</Text>
                <Text style={styles.toolSubtitle}>Priority line for tutor assistance & safety</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>

            {/* Cancel for Safety button */}
            {onCancelForSafety ? (
              <Pressable onPress={handleSafetyCancelPress} style={styles.safetyCancelCard}>
                <View style={[styles.toolIconWrap, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                </View>
                <View style={styles.toolTextWrap}>
                  <Text style={styles.safetyCancelTitle}>Cancel Session for Safety</Text>
                  <Text style={styles.safetyCancelSubtitle}>Leave immediately. Zero fee or penalty.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ef4444" />
              </Pressable>
            ) : null}

            <View style={styles.safetyNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0f766e" />
              <Text style={styles.safetyNoticeText}>
                Your safety is our highest priority. If an address looks suspicious or you feel unsafe entering, remain in your vehicle or public space and contact safety dispatch.
              </Text>
            </View>
          </ScrollView>

          <Pressable onPress={onClose} style={styles.dismissButton}>
            <Text style={styles.dismissButtonText}>Close Safety Center</Text>
          </Pressable>
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
  shieldIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d1fae5',
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  emergencyCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  emergencyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emergencyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  emergencyCardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toolTextWrap: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  toolSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  safetyCancelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  safetyCancelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#be123c',
  },
  safetyCancelSubtitle: {
    fontSize: 12,
    color: '#e11d48',
    marginTop: 2,
  },
  safetyNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    gap: 8,
  },
  safetyNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0f766e',
    lineHeight: 16,
  },
  dismissButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
