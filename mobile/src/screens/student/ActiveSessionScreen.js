import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRequestById } from '../../services/classRequestService';
import {
  confirmEndLesson,
  endSession,
  finalizeSessionClosure,
  requestEndLesson,
  subscribeToSessionById,
  toggleSessionPause,
} from '../../services/sessionService';
import { SafetySupportModal } from '../../components/common/SafetySupportModal';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { PinVerificationModal } from '../../components/student/PinVerificationModal';
import { colors } from '../../theme/colors';
import {
  formatRand,
  computeTravelFee,
  computeBookingFee,
  LEGACY_SAFE_PRICING_SNAPSHOT,
} from '../../utils/pricing';

function formatTimer(totalSecs) {
  const safeSecs = Math.max(0, Math.floor(Number(totalSecs) || 0));
  const hours = Math.floor(safeSecs / 3600);
  const minutes = Math.floor((safeSecs % 3600) / 60);
  const seconds = safeSecs % 60;
  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function ActiveSessionScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const sessionId = String(params.sessionId || '').trim();
  const requestId = String(params.requestId || '').trim();

  const [session, setSession] = useState(params.session || null);
  const [request, setRequest] = useState(params.request || null);
  const [loading, setLoading] = useState(!params.session);
  const [now, setNow] = useState(Date.now());
  const [isEnding, setIsEnding] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [error, setError] = useState('');
  const hasNavigatedSummaryRef = useRef(false);

  // Subscribe to live session document
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToSessionById(
      sessionId,
      (item) => {
        if (item) {
          setSession(item);
          setLoading(false);
        }
      },
      (err) => {
        console.warn('[ActiveSessionScreen] Session subscription error:', err);
        setError(err?.message || 'Unable to connect to live session.');
        setLoading(false);
      },
    );
    return () => unsub?.();
  }, [sessionId]);

  // Subscribe to class request document if requestId available
  const effectiveRequestId = requestId || session?.requestId || '';
  useEffect(() => {
    if (!effectiveRequestId) return;
    const unsub = subscribeToRequestById(
      effectiveRequestId,
      (item) => {
        if (item) setRequest(item);
      },
      (err) => console.warn('[ActiveSessionScreen] Request subscription error:', err),
    );
    return () => unsub?.();
  }, [effectiveRequestId]);

  // Live timer interval (ticks every 1s)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if session has transitioned to terminal status (completed or canceled)
  const sessionStatus = String(session?.status || request?.status || '').toLowerCase();
  const isTerminal = ['completed', 'settled', 'canceled', 'canceled_during', 'expired'].includes(sessionStatus);
  const isSessionActive = ['in_session', 'in_progress', 'ending_requested'].includes(sessionStatus);
  const isPinVerified = Boolean(
    session?.pinVerified
    || request?.pinVerified
    || session?.meetingConfirmed
    || request?.meetingConfirmed
  );

  useEffect(() => {
    if (isTerminal && session && !hasNavigatedSummaryRef.current) {
      hasNavigatedSummaryRef.current = true;
      navigate?.({
        key: 'SessionSummary',
        params: {
          sessionId: session.id || sessionId,
          session,
          requestId: effectiveRequestId,
          request,
          parentTab: 'Dashboard',
        },
      });
    }
  }, [effectiveRequestId, isTerminal, navigate, request, session, sessionId]);

  // Calculate elapsed time (billing clock runs only when session is active)
  const sessionStartMs = useMemo(() => {
    if (!isSessionActive) return 0;
    return Number(
      session?.billingStartedAt
      || session?.startedAt
      || session?.studentJoinedAt
      || session?.lessonStartedAt
      || 0,
    );
  }, [isSessionActive, session]);

  const totalPausedSecs = Number(session?.totalPausedSeconds || 0);
  const rawElapsedSeconds = (isSessionActive && sessionStartMs > 0)
    ? Math.max(0, Math.floor((now - sessionStartMs) / 1000))
    : 0;
  const isSessionPaused = Boolean(session?.isPaused);
  const elapsedSeconds = isSessionActive ? Math.max(0, rawElapsedSeconds - totalPausedSecs) : 0;

  const targetDurationMinutes = Math.max(
    10,
    Number(
      session?.durationMinutes
      || session?.pricingSnapshot?.durationMinutes
      || request?.durationMinutes
      || 30,
    ),
  );
  const targetDurationSeconds = targetDurationMinutes * 60;
  const progressRatio = Math.min(1, elapsedSeconds / targetDurationSeconds);
  const isOvertime = elapsedSeconds > targetDurationSeconds;
  const overtimeMinutes = isOvertime ? Math.ceil((elapsedSeconds - targetDurationSeconds) / 60) : 0;
  const remainingSeconds = Math.max(0, targetDurationSeconds - elapsedSeconds);

  // Live estimated running cost
  const ratePerMinute = Number(
    session?.pricingSnapshot?.adjustedRatePerMinute
    || session?.pricingSnapshot?.ratePerMinute
    || session?.ratePerMinute
    || request?.pricingSnapshot?.adjustedRatePerMinute
    || request?.pricingSnapshot?.ratePerMinute
    || LEGACY_SAFE_PRICING_SNAPSHOT.adjustedRatePerMinute,
  );
  const basePrice = Number(
    session?.pricingSnapshot?.adjustedBaseAmount
    || session?.pricingSnapshot?.baseAmount
    || request?.pricingSnapshot?.adjustedBaseAmount
    || 0,
  );
  const travelFee = Number(
    session?.pricingSnapshot?.transferFee
    ?? session?.pricingSnapshot?.travelFee
    ?? request?.pricingSnapshot?.transferFee
    ?? request?.pricingSnapshot?.travelFee
    ?? session?.travelFee
    ?? computeTravelFee(session?.travelDistanceKm || session?.distanceKm || 0),
  );
  const currentMinutesAttended = Math.max(1, Math.ceil(elapsedSeconds / 60));
  const currentLessonCost = Number((basePrice + (currentMinutesAttended * ratePerMinute)).toFixed(2));
  const bookingFee = Number(
    session?.pricingSnapshot?.bookingFee
    ?? session?.pricingSnapshot?.bookingFeeAmount
    ?? computeBookingFee(currentLessonCost),
  );
  const runningTotalEstimate = Number((currentLessonCost + travelFee + bookingFee).toFixed(2));

  // Tutor metadata
  const tutorName = session?.tutorName || request?.tutorName || 'Your Tutor';
  const tutorInitial = tutorName.charAt(0).toUpperCase();
  const tutorPhoto = session?.tutorPhoto || request?.tutorPhoto || null;
  const tutorPhone = session?.tutorPhone || request?.tutorPhone || '';
  const tutorRating = Number(session?.tutorRating || request?.tutorRating || 4.9);
  const subject = session?.subject || request?.subject || 'Mathematics';
  const topic = session?.topic || request?.topic || 'Lesson In Progress';
  const description = request?.description || session?.description || '';

  // Two-party handshake states (Phase 16)
  const isEndRequested = session?.status === 'ending_requested';
  const isEndRequestedByMe = isEndRequested && session?.endRequestedBy === user?.uid;
  const isEndRequestedByTutor = isEndRequested && session?.endRequestedBy && session?.endRequestedBy !== user?.uid;

  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);

  // Toggle Pause (Phase 15)
  const handleTogglePause = async () => {
    if (isPausing) return;
    setIsPausing(true);
    try {
      const nextPaused = !isSessionPaused;
      const currentIntervals = Array.isArray(session?.pausedIntervals) ? [...session.pausedIntervals] : [];
      let updatedTotal = totalPausedSecs;
      if (nextPaused) {
        currentIntervals.push({ startedAt: Date.now(), endedAt: null });
      } else {
        const lastIdx = currentIntervals.length - 1;
        if (lastIdx >= 0 && !currentIntervals[lastIdx].endedAt) {
          const pauseEnded = Date.now();
          currentIntervals[lastIdx].endedAt = pauseEnded;
          const duration = Math.max(0, Math.floor((pauseEnded - currentIntervals[lastIdx].startedAt) / 1000));
          updatedTotal += duration;
        }
      }
      await toggleSessionPause({
        sessionId: session?.id || sessionId,
        requestId: effectiveRequestId,
        isPaused: nextPaused,
        pausedIntervals: currentIntervals,
        currentTotalSeconds: updatedTotal,
      });
    } catch (err) {
      console.warn('handleTogglePause error:', err);
    } finally {
      setIsPausing(false);
    }
  };

  // Student requests end lesson (Phase 16 handshake)
  const handleEndSession = () => {
    Alert.alert(
      'Request End of Lesson?',
      `Request tutor confirmation to finish lesson? Billable time will be ${currentMinutesAttended} mins.`,
      [
        { text: 'Keep Lesson Going', style: 'cancel' },
        {
          text: 'Request End',
          style: 'destructive',
          onPress: async () => {
            const currentSession = session || { id: sessionId, requestId: effectiveRequestId };
            setIsEnding(true);
            try {
              await requestEndLesson({
                requestId: effectiveRequestId,
                sessionId: currentSession.id,
              });
            } catch (err) {
              Alert.alert('Error', err?.message || 'Unable to request lesson end.');
            } finally {
              setIsEnding(false);
            }
          },
        },
      ],
    );
  };

  // Student confirms tutor's end request (Phase 16 handshake)
  const handleConfirmEndHandshake = async () => {
    if (isConfirmingEnd) return;
    setIsConfirmingEnd(true);
    try {
      const currentSession = session || { id: sessionId, requestId: effectiveRequestId };
      const closedSession = await confirmEndLesson({
        requestId: effectiveRequestId,
        sessionId: currentSession.id,
        session: currentSession,
      });
      hasNavigatedSummaryRef.current = true;
      navigate?.({
        key: 'SessionSummary',
        params: {
          sessionId: currentSession.id,
          session: closedSession || currentSession,
          requestId: effectiveRequestId,
          request,
          parentTab: 'Dashboard',
        },
      });
    } catch (err) {
      Alert.alert('Error', err?.message || 'Unable to finalize lesson completion.');
    } finally {
      setIsConfirmingEnd(false);
    }
  };

  const handleCancelForSafety = async (reason) => {
    try {
      const currentSession = session || { id: sessionId, requestId: effectiveRequestId };
      const closedSession = await finalizeSessionClosure(currentSession, {
        closureType: 'canceled_during',
        canceledBy: 'student',
        canceledReason: reason || 'Student safety concern',
      });
      hasNavigatedSummaryRef.current = true;
      navigate?.({
        key: 'SessionSummary',
        params: {
          sessionId: currentSession.id,
          session: closedSession || currentSession,
          requestId: effectiveRequestId,
          request,
          parentTab: 'Dashboard',
        },
      });
    } catch (err) {
      console.warn('handleCancelForSafety error:', err);
    }
  };

  const handleConfirmCancel = async (payload) => {
    try {
      const currentSession = session || { id: sessionId, requestId: effectiveRequestId };
      const closedSession = await finalizeSessionClosure(currentSession, {
        closureType: 'canceled_during',
        canceledBy: 'student',
        canceledReason: payload?.reason || 'Canceled by student request',
      });
      hasNavigatedSummaryRef.current = true;
      navigate?.({
        key: 'SessionSummary',
        params: {
          sessionId: currentSession.id,
          session: closedSession || currentSession,
          requestId: effectiveRequestId,
          request,
          parentTab: 'Dashboard',
        },
      });
    } catch (err) {
      console.warn('handleConfirmCancel error:', err);
    }
  };

  const handleShareLiveSession = async () => {
    try {
      await Share.share({
        title: 'Parakleo In-Person Lesson',
        message: `I am currently in an in-person tutoring session for ${subject} with ${tutorName} via Parakleo. Elapsed time: ${formatTimer(elapsedSeconds)}.`,
      });
    } catch (_err) {}
  };

  const handleCallTutor = () => {
    if (tutorPhone) {
      Linking.openURL(`tel:${tutorPhone}`).catch(() => {
        Alert.alert('Notice', 'Phone dialer could not be opened.');
      });
    } else {
      Alert.alert('Notice', 'Tutor phone number is not available.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Connecting to active session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />

      <SafeAreaView style={styles.safeContainer}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goBack?.() || navigate?.('Dashboard')}
            style={styles.headerIconButton}
          >
            <Ionicons name="arrow-back" size={22} color="#064e3b" />
          </Pressable>

          <View style={styles.subjectHeaderPill}>
            <View style={styles.liveDot} />
            <Text style={styles.subjectHeaderText} numberOfLines={1}>
              {subject}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowSafetyModal(true)}
              style={[styles.headerIconButton, { backgroundColor: '#fee2e2' }]}
            >
              <Ionicons name="shield" size={18} color="#dc2626" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleShareLiveSession}
              style={styles.headerIconButton}
            >
              <Ionicons name="share-outline" size={20} color="#064e3b" />
            </Pressable>
          </View>
        </View>

        {/* Scrollable Main Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* PIN Verification Banner if opened before verified */}
          {!isPinVerified && ['arrived', 'waiting_student', 'preparing_for_lesson'].includes(sessionStatus) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPinModal(true)}
              style={styles.pinPromptBanner}
            >
              <Ionicons name="keypad" size={20} color="#2563eb" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1d4ed8' }}>
                  Enter 4-Digit Meeting PIN
                </Text>
                <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
                  Ask {tutorName} for the verification code to start the lesson.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#2563eb" />
            </Pressable>
          ) : null}

          {sessionStatus === 'preparing_for_lesson' ? (
            <View style={styles.prepGraceBanner}>
              <Ionicons name="book-outline" size={18} color="#7c3aed" />
              <Text style={{ fontSize: 13, color: '#6d28d9', marginLeft: 8, flex: 1, fontWeight: '500' }}>
                Preparation Grace active. Billing begins when lesson starts.
              </Text>
            </View>
          ) : null}

          {/* 1. Hero Live Timer Card */}
          <View style={styles.timerCard}>
            <View style={styles.liveBadgeRow}>
              <View style={styles.liveIndicatorPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveIndicatorText}>
                  {!isPinVerified
                    ? 'VERIFY MEETING PIN'
                    : sessionStatus === 'preparing_for_lesson'
                      ? 'PREPARING FOR LESSON'
                      : isSessionPaused
                        ? 'LESSON PAUSED'
                        : 'TUTOR ARRIVED • IN SESSION'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={handleTogglePause}
                disabled={isPausing}
                style={[
                  styles.pausePillButton,
                  isSessionPaused ? styles.resumePillButton : styles.pausePillButtonNormal,
                ]}
              >
                <Ionicons
                  name={isSessionPaused ? 'play' : 'pause'}
                  size={12}
                  color={isSessionPaused ? '#ffffff' : '#059669'}
                />
                <Text
                  style={[
                    styles.pausePillText,
                    isSessionPaused && { color: '#ffffff' },
                  ]}
                >
                  {isPausing ? '...' : isSessionPaused ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
            </View>

            {/* Giant Clock Counter */}
            <Text style={[styles.clockDisplay, isSessionPaused && { color: '#d97706' }]}>
              {formatTimer(elapsedSeconds)}
            </Text>

            {/* Progress bar tracking scheduled time */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(progressRatio * 100)}%` },
                  isOvertime && styles.progressBarOvertime,
                ]}
              />
            </View>

            <View style={styles.timerSubRow}>
              <Text style={styles.timerSubText}>
                {isOvertime
                  ? `Overtime: +${overtimeMinutes} min extra learning`
                  : `Target: ${targetDurationMinutes} mins (${Math.ceil(remainingSeconds / 60)}m remaining)`}
              </Text>
              <Text style={styles.timerRateHint}>
                {formatRand(ratePerMinute)}/min
              </Text>
            </View>
          </View>

          {/* 2. Live Running Cost Estimate */}
          <View style={styles.costEstimateCard}>
            <View style={styles.costEstimateHeader}>
              <View style={styles.costIconWrap}>
                <Ionicons name="receipt-outline" size={18} color="#059669" />
              </View>
              <View style={styles.costHeaderTexts}>
                <Text style={styles.costHeaderTitle}>Estimated Running Total</Text>
                <Text style={styles.costHeaderSubtitle}>
                  {currentMinutesAttended} min{currentMinutesAttended > 1 ? 's' : ''} attended @ {formatRand(ratePerMinute)}/min + {formatRand(travelFee)} transfer
                </Text>
              </View>
              <Text style={styles.costTotalNumber}>
                {formatRand(runningTotalEstimate)}
              </Text>
            </View>
          </View>

          {/* 3. Tutor Information Card */}
          <View style={styles.tutorCard}>
            <View style={styles.tutorTopRow}>
              {tutorPhoto ? (
                <Image source={{ uri: tutorPhoto }} style={styles.tutorAvatar} />
              ) : (
                <View style={styles.tutorAvatarFallback}>
                  <Text style={styles.tutorAvatarText}>{tutorInitial}</Text>
                </View>
              )}

              <View style={styles.tutorDetails}>
                <View style={styles.tutorNameRow}>
                  <Text style={styles.tutorName} numberOfLines={1}>
                    {tutorName}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.tutorMetaRow}>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text style={styles.ratingValue}>{tutorRating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.tutorSubjectBadge}>{subject}</Text>
                </View>
              </View>

              {tutorPhone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCallTutor}
                  style={styles.callButton}
                >
                  <Ionicons name="call" size={18} color="#ffffff" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* 4. Lesson Focus & Topic Card */}
          <View style={styles.topicCard}>
            <View style={styles.topicHeader}>
              <Ionicons name="book-outline" size={18} color="#047857" />
              <Text style={styles.topicHeaderTitle}>Lesson Focus</Text>
            </View>
            <Text style={styles.topicName}>{topic}</Text>
            {description ? (
              <Text style={styles.topicDescription}>{description}</Text>
            ) : null}
          </View>

          {/* Handshake Prompt: Tutor Requested End (Phase 16) */}
          {isEndRequestedByTutor && (
            <View style={styles.handshakeCard}>
              <View style={styles.handshakeIconWrap}>
                <Ionicons name="checkmark-done-circle" size={24} color="#059669" />
              </View>
              <View style={styles.handshakeTextWrap}>
                <Text style={styles.handshakeTitle}>Tutor Finished Lesson</Text>
                <Text style={styles.handshakeSubtitle}>
                  {tutorName} requested to complete this lesson ({currentMinutesAttended} min). Please confirm to settle.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirmEndHandshake}
                disabled={isConfirmingEnd}
                style={styles.handshakeConfirmButton}
              >
                {isConfirmingEnd ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.handshakeConfirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Handshake Status: Student Requested End (Phase 16) */}
          {isEndRequestedByMe && (
            <View style={[styles.handshakeCard, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
              <View style={[styles.handshakeIconWrap, { backgroundColor: '#ccfbf1' }]}>
                <Ionicons name="hourglass-outline" size={20} color="#0f766e" />
              </View>
              <View style={styles.handshakeTextWrap}>
                <Text style={[styles.handshakeTitle, { color: '#0f766e' }]}>Awaiting Tutor Confirmation</Text>
                <Text style={[styles.handshakeSubtitle, { color: '#115e59' }]}>
                  You requested to finish the lesson. Waiting for {tutorName} to confirm.
                </Text>
              </View>
            </View>
          )}

          {/* 5. In-Person Learning Checklist */}
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>In-Person Session Tips</Text>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>Work together through practice questions</Text>
            </View>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>Ask for step-by-step methods and examples</Text>
            </View>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>You will rate your tutor when this session finishes</Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* 6. Action Controls */}
          <View style={styles.actionsContainer}>
            <Pressable
              accessibilityRole="button"
              disabled={isEnding || isCanceling || isEndRequestedByMe}
              onPress={handleEndSession}
              style={[
                styles.endSessionButton,
                (isEnding || isCanceling || isEndRequestedByMe) && styles.buttonDisabled,
              ]}
            >
              {isEnding ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.endSessionButtonText}>
                    {isEndRequestedByMe ? 'Awaiting Tutor Confirmation...' : 'End Lesson & Settle'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isEnding || isCanceling}
              onPress={() => setShowCancelModal(true)}
              style={styles.cancelLinkButton}
            >
              {isCanceling ? (
                <ActivityIndicator size="small" color="#e11d48" />
              ) : (
                <Text style={styles.cancelLinkText}>Report issue or cancel lesson</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>

        {/* Safety Modal (Phase 21) */}
        <SafetySupportModal
          visible={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          sessionId={session?.id || sessionId}
          requestId={effectiveRequestId}
          role="student"
          partnerName={tutorName}
          onInstantCancel={handleCancelForSafety}
        />

        {/* Cancellation Quote Modal (Phase 17) */}
        <CancellationQuoteModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          sessionId={session?.id || sessionId}
          requestId={effectiveRequestId}
          role="student"
          status={session?.status || 'in_session'}
          onConfirmCancel={handleConfirmCancel}
        />

        {/* 4-Digit PIN Verification Modal (Milestone M5) */}
        <PinVerificationModal
          visible={showPinModal}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setShowPinModal(false);
          }}
          requestId={effectiveRequestId}
          sessionId={session?.id || sessionId}
          tutorName={tutorName}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  safeContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 0,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#064e3b',
    fontWeight: '500',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  subjectHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    maxWidth: '65%',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  subjectHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  timerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginTop: 6,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  liveBadgeRow: {
    marginBottom: 12,
  },
  liveIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  clockDisplay: {
    fontSize: 54,
    fontWeight: '800',
    color: '#064e3b',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginVertical: 4,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressBarOvertime: {
    backgroundColor: '#f59e0b',
  },
  timerSubRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerSubText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  timerRateHint: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
  },
  costEstimateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  costEstimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  costIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  costHeaderTexts: {
    flex: 1,
  },
  costHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  costHeaderSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  costTotalNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
    marginLeft: 8,
  },
  tutorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tutorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tutorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  tutorAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tutorAvatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  tutorDetails: {
    flex: 1,
  },
  tutorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 2,
  },
  tutorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    marginLeft: 3,
  },
  tutorSubjectBadge: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  topicCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  checklistCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  errorText: {
    color: '#e11d48',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  endSessionButton: {
    backgroundColor: '#059669',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  endSessionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelLinkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e11d48',
  },
  pausePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
  },
  pausePillButtonNormal: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  resumePillButton: {
    backgroundColor: '#d97706',
    borderColor: '#b45309',
  },
  pausePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  handshakeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  handshakeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handshakeTextWrap: {
    flex: 1,
  },
  handshakeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  handshakeSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  handshakeConfirmButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  handshakeConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pinPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  prepGraceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
});
