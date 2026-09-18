import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRequestById } from '../../services/classRequestService';
import { subscribeToLiveTracking } from '../../services/liveTrackingRealtimeService';
import { cancelInPersonSession } from '../../services/sessionService';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { extractSafetySnapshot } from '../../constants/safety';
import { calculateTutorOfferPayout } from '../../constants/pricing';
import { colors } from '../../theme/colors';

const STATUS_CONFIG = {
  pending: { label: 'Pending', tone: '#f59e0b', bg: '#fef3c7', icon: 'time-outline' },
  matching: { label: 'Matching', tone: '#f59e0b', bg: '#fef3c7', icon: 'search-outline' },
  offered: { label: 'Offer Received', tone: '#3b82f6', bg: '#eff6ff', icon: 'mail-unread-outline' },
  accepted: { label: 'Accepted', tone: '#059669', bg: '#ecfdf5', icon: 'checkmark-circle-outline' },
  tutor_accepted: { label: 'Accepted', tone: '#059669', bg: '#ecfdf5', icon: 'checkmark-circle-outline' },
  tutor_assigned: { label: 'Assigned', tone: '#059669', bg: '#ecfdf5', icon: 'person-outline' },
  traveling: { label: 'Travelling', tone: '#0284c7', bg: '#e0f2fe', icon: 'car-sport-outline' },
  travelling: { label: 'Travelling', tone: '#0284c7', bg: '#e0f2fe', icon: 'car-sport-outline' },
  in_transit: { label: 'Travelling', tone: '#0284c7', bg: '#e0f2fe', icon: 'car-sport-outline' },
  arrived: { label: 'Arrived', tone: '#059669', bg: '#ecfdf5', icon: 'location-outline' },
  waiting_student: { label: 'Waiting for Student', tone: '#059669', bg: '#ecfdf5', icon: 'hourglass-outline' },
  preparing_for_lesson: { label: 'Preparing', tone: '#7c3aed', bg: '#f5f3ff', icon: 'book-outline' },
  in_session: { label: 'In Session', tone: '#059669', bg: '#ecfdf5', icon: 'play-circle-outline' },
  in_progress: { label: 'In Progress', tone: '#059669', bg: '#ecfdf5', icon: 'play-circle-outline' },
  completed: { label: 'Completed', tone: '#059669', bg: '#ecfdf5', icon: 'checkmark-done-circle-outline' },
  settled: { label: 'Settled', tone: '#059669', bg: '#ecfdf5', icon: 'cash-outline' },
  canceled: { label: 'Canceled', tone: '#dc2626', bg: '#fee2e2', icon: 'close-circle-outline' },
  canceled_by_tutor: { label: 'Canceled by You', tone: '#dc2626', bg: '#fee2e2', icon: 'close-circle-outline' },
  canceled_by_student: { label: 'Canceled by Student', tone: '#dc2626', bg: '#fee2e2', icon: 'close-circle-outline' },
};

function formatCurrency(val) {
  const num = Number(val || 0);
  return `R${num.toFixed(2)}`;
}

export function TutorRequestDetailsScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const requestId = String(params.requestId || params.request?.id || '').trim();
  const sessionId = String(params.sessionId || params.request?.sessionId || '').trim();
  const initialRequest = params.request || null;

  const [currentRequest, setCurrentRequest] = useState(initialRequest);
  const [liveTracking, setLiveTracking] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!requestId) return () => {};
    return subscribeToRequestById(
      requestId,
      (item) => {
        if (item) setCurrentRequest(item);
      },
      () => {}
    );
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return () => {};
    return subscribeToLiveTracking(requestId, setLiveTracking, () => null);
  }, [requestId]);

  const req = currentRequest || initialRequest || {};
  const effSessionId = sessionId || req.sessionId || requestId;

  const currentStatus = String(liveTracking?.status || req.status || 'accepted').toLowerCase();
  const statusCfg = STATUS_CONFIG[currentStatus] || {
    label: currentStatus.replace(/_/g, ' '),
    tone: '#64748b',
    bg: '#f1f5f9',
    icon: 'help-circle-outline',
  };

  const isNavigable = [
    'accepted',
    'tutor_accepted',
    'tutor_assigned',
    'traveling',
    'travelling',
    'in_transit',
    'arrived',
    'waiting_student',
    'preparing_for_lesson',
  ].includes(currentStatus);

  const isInSession = ['in_session', 'in_progress'].includes(currentStatus);
  const isTerminal = ['completed', 'settled', 'canceled', 'canceled_by_tutor', 'canceled_by_student'].includes(currentStatus);

  const safety = useMemo(() => extractSafetySnapshot(req), [req]);

  const pricingSnapshot = req.pricingSnapshot || null;
  const computedPayout = useMemo(() => {
    if (pricingSnapshot) {
      return calculateTutorOfferPayout(pricingSnapshot);
    }
    return {
      tutorPayout: 0,
      lessonFee: 0,
      travelFee: 0,
      platformFee: 0,
      bookingFee: 0,
      totalAmount: 0,
    };
  }, [pricingSnapshot]);

  const studentName = liveTracking?.studentName || req.studentName || 'Student';
  const studentAddress = liveTracking?.meetingAddress || liveTracking?.studentAddress || req.meetingAddress || req.studentAddress || req.locationAddress || 'Student location';
  const subject = req.subject || 'Lesson';
  const topic = req.topic || 'General';
  const duration = Number(pricingSnapshot?.durationMinutes || req.durationMinutes || 30);
  const verificationPin = req.verificationPin || liveTracking?.verificationPin || null;

  // Preparation Grace Countdown
  const prepGraceEndsAt = Number(req.preparationGraceEndsAt || liveTracking?.preparationGraceEndsAt || 0);
  const remainingPrepGraceMs = prepGraceEndsAt ? Math.max(0, prepGraceEndsAt - now) : 0;
  const prepMinutes = Math.floor(remainingPrepGraceMs / 60000);
  const prepSeconds = Math.floor((remainingPrepGraceMs % 60000) / 1000);
  const prepCountdownText = `${String(prepMinutes).padStart(2, '0')}:${String(prepSeconds).padStart(2, '0')}`;

  const handleReturnToNavigation = () => {
    if (typeof navigate === 'function') {
      navigate('TutorNavigation', {
        requestId,
        sessionId: effSessionId,
        request: req,
      });
    }
  };

  const handleReturnToSession = () => {
    if (typeof navigate === 'function') {
      navigate('TutorActiveSession', {
        requestId,
        sessionId: effSessionId,
        request: req,
      });
    }
  };

  const handleConfirmCancel = async (payload) => {
    setShowCancelModal(false);
    setIsCanceling(true);
    try {
      await cancelInPersonSession({
        requestId,
        sessionId: effSessionId,
        session: req,
        canceledBy: 'tutor',
        reason: payload?.reason || 'Canceled by tutor from Request Details',
      });
      Alert.alert('Request Canceled', 'This tutoring request has been canceled.');
      if (typeof navigate === 'function') {
        navigate('TutorDashboard');
      } else if (typeof goBack === 'function') {
        goBack();
      }
    } catch (err) {
      Alert.alert('Cancellation Error', err?.message || 'Failed to cancel request. Please try again.');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleBack = () => {
    if (typeof goBack === 'function') {
      goBack();
    } else if (typeof navigate === 'function') {
      navigate('TutorDashboard');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Request Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon} size={14} color={statusCfg.tone} />
          <Text style={[styles.statusBadgeText, { color: statusCfg.tone }]}>{statusCfg.label}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Physical Meeting PIN Card (when arrived / preparing) */}
        {verificationPin && ['arrived', 'waiting_student', 'preparing_for_lesson'].includes(currentStatus) ? (
          <View style={styles.pinCard}>
            <View style={styles.pinHeader}>
              <Ionicons name="keypad" size={18} color="#059669" />
              <Text style={styles.pinHeaderTitle}>PHYSICAL MEETING PIN</Text>
            </View>
            <Text style={styles.pinCode}>{verificationPin}</Text>
            <Text style={styles.pinSubtitle}>
              Show this 4-digit code to the student to verify arrival and begin the lesson.
            </Text>
          </View>
        ) : null}

        {/* Preparation Grace Period Banner */}
        {currentStatus === 'preparing_for_lesson' ? (
          <View style={styles.prepGraceBanner}>
            <Ionicons name="book-outline" size={18} color="#7c3aed" />
            <Text style={styles.prepGraceText}>
              Preparation Grace: <Text style={styles.prepGraceCountdown}>{prepCountdownText}</Text>
            </Text>
          </View>
        ) : null}

        {/* Student & Destination Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={20} color="#059669" />
            <Text style={styles.cardSectionTitle}>Student & Destination</Text>
          </View>

          <View style={styles.studentInfoRow}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>{String(studentName).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.studentDetailsWrap}>
              <Text style={styles.studentNameText}>{studentName}</Text>
              <Text style={styles.studentAddressText} numberOfLines={3}>{studentAddress}</Text>
            </View>
          </View>

          {/* Safety / Guardian Banner */}
          {(safety.isMinor || safety.guardianPresenceRequired) ? (
            <View style={styles.safetyBanner}>
              <Ionicons name="shield-checkmark" size={16} color="#d97706" />
              <Text style={styles.safetyBannerText}>
                {safety.isMinor ? 'Minor Learner' : 'Guardian Required'} — Parent/Guardian must be present during lesson.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Lesson Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="school" size={20} color="#059669" />
            <Text style={styles.cardSectionTitle}>Lesson Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subject</Text>
            <Text style={styles.infoValue}>{subject}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Topic</Text>
            <Text style={styles.infoValue}>{topic}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{duration} minutes</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mode</Text>
            <View style={styles.pillTag}>
              <Ionicons name="location" size={12} color="#059669" />
              <Text style={styles.pillTagText}>In-Person</Text>
            </View>
          </View>
        </View>

        {/* Pricing & Payout Breakdown Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash" size={20} color="#059669" />
            <Text style={styles.cardSectionTitle}>Earnings & Breakdown</Text>
          </View>

          <View style={styles.payoutHighlightBox}>
            <Text style={styles.payoutHighlightLabel}>Your Estimated Payout</Text>
            <Text style={styles.payoutHighlightValue}>
              {formatCurrency(computedPayout.tutorPayout || pricingSnapshot?.payoutBreakdown?.tutorAmount)}
            </Text>
            <Text style={styles.payoutHighlightSub}>
              Includes 73% lesson revenue share + 100% travel surcharge
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Lesson Fee</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(computedPayout.lessonFee || pricingSnapshot?.lessonFee)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Travel Surcharge (100% to tutor)</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(computedPayout.travelFee || pricingSnapshot?.travelFee)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Booking Fee (platform)</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(computedPayout.bookingFee || pricingSnapshot?.bookingFee)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownTotalLabel}>Student Total</Text>
            <Text style={styles.breakdownTotalValue}>
              {formatCurrency(computedPayout.totalAmount || pricingSnapshot?.totalAmount)}
            </Text>
          </View>
        </View>

        {/* Action Buttons Section */}
        <View style={styles.actionsSection}>
          {isNavigable ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleReturnToNavigation}
              style={styles.primaryActionButton}
            >
              <Ionicons name="navigate" size={18} color="#ffffff" />
              <Text style={styles.primaryActionButtonText}>Back to Navigation</Text>
            </Pressable>
          ) : null}

          {isInSession ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleReturnToSession}
              style={styles.primaryActionButton}
            >
              <Ionicons name="play-circle" size={18} color="#ffffff" />
              <Text style={styles.primaryActionButtonText}>Back to Active Session</Text>
            </Pressable>
          ) : null}

          {/* Cancel Request Button */}
          {!isTerminal ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCancelModal(true)}
              disabled={isCanceling}
              style={styles.cancelActionButton}
            >
              {isCanceling ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                  <Text style={styles.cancelActionButtonText}>Cancel This Request</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.terminalNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              <Text style={styles.terminalNoticeText}>This request is closed ({statusCfg.label}).</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cancellation Quote Modal */}
      <CancellationQuoteModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={handleConfirmCancel}
        requestId={requestId}
        sessionId={effSessionId}
        currentStatus={currentStatus}
        userRole="tutor"
      />
    </SafeAreaView>
  );
}

export default TutorRequestDetailsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  pinCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pinHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#047857',
  },
  pinCode: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
    color: '#065f46',
    marginVertical: 4,
  },
  pinSubtitle: {
    fontSize: 12,
    color: '#047857',
    textAlign: 'center',
    marginTop: 2,
  },
  prepGraceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    justifyContent: 'center',
  },
  prepGraceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6d28d9',
  },
  prepGraceCountdown: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5b21b6',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  studentDetailsWrap: {
    flex: 1,
  },
  studentNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  studentAddressText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 6,
    marginTop: 12,
  },
  safetyBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillTagText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  payoutHighlightBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  payoutHighlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutHighlightValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#15803d',
    marginVertical: 4,
  },
  payoutHighlightSub: {
    fontSize: 11,
    color: '#166534',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  breakdownValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  breakdownTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionsSection: {
    gap: 12,
    marginTop: 6,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderColor: '#fecdd3',
    borderWidth: 1.5,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cancelActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  terminalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  terminalNoticeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
});
