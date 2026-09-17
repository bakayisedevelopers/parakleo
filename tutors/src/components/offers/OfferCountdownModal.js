import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { calculateTutorOfferPayout } from '../../constants/pricing';
import { extractSafetySnapshot } from '../../constants/safety';
import { OFFER_TIMEOUT_SECONDS } from '../../constants/lifecycle';
import { colors } from '../../theme/colors';

export function OfferCountdownModal({
  visible,
  request,
  onAccept,
  onDecline,
  loading = false,
  totalTimeoutSeconds = OFFER_TIMEOUT_SECONDS,
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(totalTimeoutSeconds);

  useEffect(() => {
    if (!visible || !request) return;

    // Reset countdown whenever a new offer is shown
    setSecondsRemaining(totalTimeoutSeconds);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline?.(); // auto decline on 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, request, totalTimeoutSeconds]);

  if (!request) return null;

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalTimeoutSeconds) * 100));
  const pricing = request.pricingSnapshot || {};
  const requestedDuration = Number(
    request.durationMinutes || pricing.requestedDurationMinutes || pricing.durationMinutes || 10
  );
  const isInPerson = request.mode === 'in_person';
  const travelDistanceKm = Number(request.travelDistanceKm || request.distanceKm || 0);
  const payoutInfo = calculateTutorOfferPayout({
    pricingSnapshot: pricing,
    durationMinutes: requestedDuration,
    mode: request.mode,
    travelDistanceKm,
  });
  const tutorEarnings = payoutInfo.totalTutorEarnings.toFixed(2);
  const totalAmount = Number(
    pricing.finalPrice ?? pricing.totalAmount ?? (payoutInfo.lessonTuition + payoutInfo.travelFee)
  );
  const meetingLocation = request.meetingAddress || request.studentAddress || request.locationAddress || '';
  const attachmentUrl = request.attachment?.downloadUrl || request.imageAttachment;
  const safety = extractSafetySnapshot(request);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Top Progress Bar */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <ScrollView contentContainerStyle={styles.cardInner} keyboardShouldPersistTaps="handled">
            {/* Header / Badges */}
            <View style={styles.headerRow}>
              <View style={styles.badgeRow}>
                <Badge variant="emerald">{request.subject || 'Mathematics'}</Badge>
                <Badge variant={isInPerson ? 'amber' : 'sky'}>
                  {isInPerson ? '📍 In-Person Class' : '💻 Online Live'}
                </Badge>
                {isInPerson && travelDistanceKm > 0 ? (
                  <Badge variant="zinc">
                    🚗 {travelDistanceKm.toFixed(1)} km
                  </Badge>
                ) : null}
                {safety.isMinor ? (
                  <Badge variant="amber">🛡️ Minor Learner</Badge>
                ) : null}
                {safety.guardianPresenceRequired ? (
                  <Badge variant="violet">👥 Guardian Required</Badge>
                ) : null}
                {safety.preferPublicMeetingPlace ? (
                  <Badge variant="sky">🏢 Public Place</Badge>
                ) : null}
              </View>
              <View style={styles.timerBadge}>
                <Ionicons name="timer-outline" size={16} color={colors.amber} />
                <Text style={styles.timerText}>{secondsRemaining}s</Text>
              </View>
            </View>

            {/* Guardian Presence Safety Notice (REQ-011) */}
            {isInPerson && (safety.isMinor || safety.guardianPresenceRequired) ? (
              <View style={styles.safetyReminderBox}>
                <Ionicons name="shield-checkmark" size={15} color="#b45309" />
                <Text style={styles.safetyReminderText}>
                  Guardian presence required for this minor learner before beginning the lesson.
                </Text>
              </View>
            ) : null}

            {/* Topic & Description */}
            <Text style={styles.topicText}>{request.topic || 'Class Tutoring Offer'}</Text>
            {request.description ? (
              <Text style={styles.descText}>
                {request.description}
              </Text>
            ) : null}

            {/* Attachment Preview (if student uploaded a photo/problem) */}
            {attachmentUrl ? (
              <View style={styles.attachmentBox}>
                <Ionicons name="image-outline" size={16} color={colors.brandDark} />
                <Text style={styles.attachmentLabel} numberOfLines={1}>
                  {request.attachment?.fileName || 'Attached Problem Image'}
                </Text>
              </View>
            ) : null}

            {/* Student Info Box */}
            <View style={styles.studentInfoBox}>
              <View style={styles.studentRow}>
                <View style={styles.studentAvatar}>
                  <Ionicons name="school" size={22} color={colors.brandDark} />
                </View>
                <View style={styles.studentMeta}>
                  <Text style={styles.studentName}>
                    {request.studentName || 'Student'}
                  </Text>
                  <Text style={styles.studentGrade}>
                    {request.grade || 'High School'} • {request.curriculum || 'CAPS Curriculum'}
                  </Text>
                </View>
                <View style={styles.durationTag}>
                  <Text style={styles.durationText}>{requestedDuration} Mins</Text>
                </View>
              </View>
              {isInPerson && meetingLocation ? (
                <View style={styles.locationBox}>
                  <Ionicons name="location-outline" size={16} color={colors.brandDark} />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {meetingLocation}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Tutor Earnings Quote Card */}
            <View style={styles.earningsQuoteCard}>
              <View style={styles.earningsRow}>
                <View>
                  <Text style={styles.earningsLabel}>Your Estimated Earnings</Text>
                  <Text style={styles.earningsValue}>R{tutorEarnings}</Text>
                </View>
                <Badge variant="emerald">73% Tutor Split</Badge>
              </View>
              <Text style={styles.earningsSubtext}>
                {isInPerson && payoutInfo.travelFee > 0
                  ? `incl. R${payoutInfo.travelFee.toFixed(2)} travel fee (100% to you) • R${payoutInfo.tutorLessonShare.toFixed(2)} lesson share`
                  : `73% share of R${payoutInfo.lessonTuition.toFixed(2)} lesson tuition`}
              </Text>
              <Text style={[styles.earningsSubtext, { marginTop: 3, opacity: 0.85 }]}>
                Total Student Charge: R{totalAmount.toFixed(2)} • Time-based billing
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Button
                variant="outline"
                size="md"
                onPress={onDecline}
                disabled={loading}
                style={styles.declineButton}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={onAccept}
                loading={loading}
                style={styles.acceptButton}
              >
                Accept Offer ({secondsRemaining}s)
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
    maxHeight: '90%',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand,
  },
  cardInner: {
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.amber,
  },
  topicText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  descText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  attachmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brandDark,
    flex: 1,
  },
  studentInfoBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentMeta: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  studentGrade: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  durationTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  locationText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  earningsQuoteCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#14532d',
    marginTop: 2,
  },
  earningsSubtext: {
    fontSize: 11,
    color: '#15803d',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 2,
  },
  safetyReminderBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  safetyReminderText: {
    color: '#92400e',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
