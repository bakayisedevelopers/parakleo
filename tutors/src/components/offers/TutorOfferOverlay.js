import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTutorAvailableRequests } from '../../hooks/useClassRequests';
import { getTutorOnboardingStatus } from '../../constants/onboarding';
import { acceptClassRequest, declineClassRequest } from '../../services/classRequestService';
import { findSessionIdByRequestAndTutor } from '../../services/sessionService';
import { TUTOR_PAYOUT_RATE, calculateTutorOfferPayout } from '../../constants/pricing';
import { extractSafetySnapshot } from '../../constants/safety';
import { OFFER_TIMEOUT_MS, OFFER_TIMEOUT_SECONDS, normalizeOfferExpiresAt } from '../../constants/lifecycle';
import { colors } from '../../theme/colors';

function getCountdownColor(secondsLeft) {
  if (secondsLeft <= 10) return '#ef4444';
  if (secondsLeft <= 20) return '#f59e0b';
  return '#22c55e';
}

function getOfferDismissKey(offer) {
  if (!offer?.id) return '';
  const revision = Number(offer.offerRevision || 0) || 0;
  return `${offer.id}:${revision}`;
}

export function TutorOfferOverlay({ bottomSafeInset = 0, onNavigate }) {
  const { user } = useAuth();
  const { requests } = useTutorAvailableRequests(user?.uid);
  const [now, setNow] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const [dismissedOfferKeys, setDismissedOfferKeys] = useState([]);
  const [latchedOffer, setLatchedOffer] = useState(null);
  const shimmer = useRef(new Animated.Value(0)).current;
  const acceptInFlight = useRef(false);

  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user || {}), [user]);
  const isOnline = user?.onlineStatus === 'online';
  const canRespond = Boolean(user?.uid && onboardingStatus.complete && isOnline);

  const visibleOffers = useMemo(() => {
    return (Array.isArray(requests) ? requests : []).filter((offer) => {
      const dismissKey = getOfferDismissKey(offer);
      if (!offer?.id || dismissedOfferKeys.includes(dismissKey)) return false;
      const expiresAt = normalizeOfferExpiresAt(offer.offerExpiresAt);
      return !expiresAt || expiresAt > now;
    });
  }, [requests, dismissedOfferKeys, now]);

  const liveOffer = visibleOffers[0] || null;

  useEffect(() => {
    if (liveOffer?.id) {
      setLatchedOffer(liveOffer);
    }
  }, [liveOffer]);

  const activeOffer = liveOffer || latchedOffer;

  const expiresAtMs = useMemo(() => {
    return normalizeOfferExpiresAt(activeOffer?.offerExpiresAt);
  }, [activeOffer?.offerExpiresAt]);

  useEffect(() => {
    if (!expiresAtMs) return () => {};
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [expiresAtMs]);

  useEffect(() => {
    if (!activeOffer?.id) return () => {};

    shimmer.setValue(0);
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        duration: 1800,
        toValue: 1,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => {
      animation.stop();
      shimmer.stopAnimation();
      shimmer.setValue(0);
    };
  }, [activeOffer?.id, shimmer]);

  const secondsLeft = useMemo(() => {
    if (!expiresAtMs) return OFFER_TIMEOUT_SECONDS;
    return Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
  }, [expiresAtMs, now]);

  const countdownRatio = expiresAtMs
    ? Math.max(0, Math.min(1, (expiresAtMs - now) / OFFER_TIMEOUT_MS))
    : 1;
  const countdownColor = getCountdownColor(secondsLeft);
  const isExpired = Boolean(expiresAtMs) && secondsLeft <= 0;

  useEffect(() => {
    if (!latchedOffer?.id || liveOffer?.id) return;
    const latchedExpiresAt = normalizeOfferExpiresAt(latchedOffer.offerExpiresAt);
    if (latchedExpiresAt && latchedExpiresAt <= now) {
      setLatchedOffer(null);
    }
  }, [latchedOffer, liveOffer?.id, now]);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-280, 280],
  });

  const handleDecline = async (offerToDecline) => {
    const offer = offerToDecline || activeOffer;
    if (!offer?.id || !user?.uid) return;

    const dismissKey = getOfferDismissKey(offer);
    setDismissedOfferKeys((prev) => (prev.includes(dismissKey) ? prev : [...prev, dismissKey]));
    setLatchedOffer((current) => (current?.id === offer.id ? null : current));
    try {
      setIsProcessing(true);
      await declineClassRequest({ requestId: offer.id, tutorId: user.uid });
    } catch (err) {
      console.warn('[TutorOfferOverlay] Error declining offer:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = async () => {
    const targetOffer = activeOffer;
    if (!targetOffer?.id || !user?.uid) return;
    // Ref-based guard: prevents double-tap race where second tap fires before
    // React re-renders with isProcessing=true (state updates are async).
    if (acceptInFlight.current) return;
    acceptInFlight.current = true;

    const offerId = targetOffer.id;
    setIsProcessing(true);

    try {
      let acceptResult = null;
      try {
        acceptResult = await acceptClassRequest({
          requestId: offerId,
          tutorId: user.uid,
          tutorName: user.fullName || user.displayName || 'Tutor',
          tutorEmail: user.email || '',
        });
      } catch (acceptErr) {
        // "Class request is no longer available" means a prior tap already accepted it.
        // Treat this as a recoverable success and navigate to the session.
        const msg = acceptErr?.message || '';
        const alreadyAccepted = msg.includes('no longer available') || msg.includes('already') || msg.includes('accepted');
        if (!alreadyAccepted) throw acceptErr;
        console.warn('[TutorOfferOverlay] Offer already accepted by previous tap, navigating to session.');
      }

      const sessionId = acceptResult?.sessionId
        || await findSessionIdByRequestAndTutor({ requestId: offerId, tutorId: user.uid })
        || offerId;
      const dismissKey = getOfferDismissKey(targetOffer);
      setLatchedOffer((current) => (current?.id === offerId ? null : current));
      setDismissedOfferKeys((prev) => (prev.includes(dismissKey) ? prev : [...prev, dismissKey]));

      if (targetOffer.mode === 'in_person' && onNavigate) {
        onNavigate('TutorNavigation', { requestId: offerId, sessionId, request: targetOffer });
      } else if (sessionId && onNavigate) {
        onNavigate('SessionRoom', { sessionId });
      } else if (onNavigate) {
        onNavigate('MyClasses');
      }
    } catch (err) {
      console.warn('[TutorOfferOverlay] Error accepting offer:', err);
    } finally {
      setIsProcessing(false);
      acceptInFlight.current = false;
    }
  };

  // Auto-decline when time expires
  useEffect(() => {
    if (liveOffer?.id && activeOffer?.id === liveOffer.id && isExpired && !isProcessing) {
      handleDecline(activeOffer);
    }
  }, [isExpired, liveOffer?.id, activeOffer, isProcessing]);

  const activeOfferStatus = String(activeOffer?.status || '').toLowerCase();
  const isOfferActiveOrCompleted = [
    'accepted',
    'tutor_accepted',
    'tutor_assigned',
    'travelling',
    'traveling',
    'en_route',
    'in_transit',
    'arrived',
    'waiting_student',
    'preparing_for_lesson',
    'in_session',
    'in_progress',
    'completed',
  ].includes(activeOfferStatus);

  if (!activeOffer || isExpired || isOfferActiveOrCompleted) return null;

  const pricing = activeOffer.pricingSnapshot || {};
  const requestedDuration = Number(
    activeOffer.durationMinutes || pricing.requestedDurationMinutes || pricing.durationMinutes || 10
  );
  const isInPerson = activeOffer.mode === 'in_person';
  const travelDistanceKm = Number(activeOffer.travelDistanceKm || activeOffer.distanceKm || 0);
  const payoutInfo = calculateTutorOfferPayout({
    pricingSnapshot: pricing,
    durationMinutes: requestedDuration,
    mode: activeOffer.mode,
    travelDistanceKm,
  });
  const tutorEarnings = payoutInfo.totalTutorEarnings.toFixed(2);
  const meetingLocation = activeOffer.meetingAddress || activeOffer.studentAddress || activeOffer.locationAddress || '';
  const safety = extractSafetySnapshot(activeOffer);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.portal,
        { paddingBottom: Math.max(0, Number(bottomSafeInset || 0)) },
      ]}
    >
      <View pointerEvents="none" style={styles.backdrop} />
      <View style={[styles.sheetWrap, { paddingBottom: Math.max(0, Number(bottomSafeInset || 0)) }]}>
        <View style={styles.sheet}>
          {/* Top dynamic color countdown progress bar */}
          <View
            style={[
              styles.countdownFill,
              { width: `${countdownRatio * 100}%`, backgroundColor: countdownColor },
            ]}
          />
          {/* Animated shimmer sweep */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }, { rotate: '12deg' }],
              },
            ]}
          />

          <View style={styles.content}>
            {/* Eyebrow & Badges */}
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrow}>Incoming Class Offer</Text>
              <View style={styles.timerBadge}>
                <Ionicons name="timer-outline" size={14} color={countdownColor} />
                <Text style={[styles.timerText, { color: countdownColor }]}>{secondsLeft}s</Text>
              </View>
            </View>

            {/* Header / Title & Earnings */}
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.title} numberOfLines={1}>
                  {activeOffer.topic || `${activeOffer.subject || 'Class'} Tutoring`}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {activeOffer.studentName || 'Student'} • {activeOffer.grade || 'High School'} • {requestedDuration} Mins
                </Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeLabel}>EST. PAYOUT</Text>
                <Text style={styles.priceBadgeText}>R{tutorEarnings}</Text>
                {isInPerson && payoutInfo.travelFee > 0 ? (
                  <Text style={styles.priceBadgeSub}>incl. R{payoutInfo.travelFee.toFixed(2)} travel</Text>
                ) : null}
              </View>
            </View>

            {/* Mode & Subject Pills */}
            <View style={styles.badgeRow}>
              <Badge variant="emerald">{activeOffer.subject || 'Mathematics'}</Badge>
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
              {isInPerson && meetingLocation ? (
                <Text style={styles.addressText} numberOfLines={1}>
                  📍 {meetingLocation}
                </Text>
              ) : null}
            </View>

            {/* Guardian Presence Safety Notice (REQ-011) */}
            {isInPerson && (safety.isMinor || safety.guardianPresenceRequired) ? (
              <View style={styles.safetyReminderBox}>
                <Ionicons name="shield-checkmark" size={14} color="#b45309" />
                <Text style={styles.safetyReminderText}>
                  Guardian presence required for this minor learner before beginning the lesson.
                </Text>
              </View>
            ) : null}

            {/* Warnings if offline or incomplete */}
            {!canRespond ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  {!isOnline
                    ? 'You are currently offline. Switch online in Dashboard to accept offers.'
                    : onboardingStatus.message || 'Complete onboarding before accepting offers.'}
                </Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                variant="outline"
                size="md"
                onPress={() => handleDecline(activeOffer)}
                disabled={isProcessing}
                style={styles.buttonFill}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={handleAccept}
                disabled={!canRespond || isProcessing || secondsLeft <= 0}
                loading={isProcessing}
                style={styles.buttonFill}
              >
                Accept ({secondsLeft}s)
              </Button>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  sheetWrap: {
    paddingHorizontal: 0,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    minHeight: 240,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  countdownFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.12,
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  content: {
    padding: 18,
    gap: 12,
    position: 'relative',
    zIndex: 2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: colors.brandDark,
    textTransform: 'uppercase',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  priceBadge: {
    backgroundColor: colors.brandDark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  priceBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  priceBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  priceBadgeSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#a7f3d0',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  addressText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  warningCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonFill: {
    flex: 1,
  },
  safetyReminderBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  safetyReminderText: {
    color: '#92400e',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
