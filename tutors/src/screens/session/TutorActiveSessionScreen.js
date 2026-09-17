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
  startInPersonLesson,
  subscribeToSessionById,
  toggleSessionPause,
} from '../../services/sessionService';
import { SafetySupportModal } from '../../components/common/SafetySupportModal';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { extractSafetySnapshot } from '../../constants/safety';
import {
  computeTravelFee,
  formatCurrency,
  TUTOR_PAYOUT_RATE,
} from '../../constants/pricing';

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

function formatGraceCountdown(remainingMs) {
  const totalSecs = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRand(amount) {
  return `R${Number(amount || 0).toFixed(2)}`;
}

export function TutorActiveSessionScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const sessionId = String(params.sessionId || '').trim();
  const requestId = String(params.requestId || '').trim();

  const [session, setSession] = useState(params.session || null);
  const [request, setRequest] = useState(params.request || null);
  const [loading, setLoading] = useState(!params.session && !params.request);
  const [now, setNow] = useState(Date.now());
  const [isEnding, setIsEnding] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState('');
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [isStartingLesson, setIsStartingLesson] = useState(false);
  const hasNavigatedSummaryRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  // Subscribe to live session document
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToSessionById(
      sessionId,
      (item) => {
        if (item) {
          setSession(item);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[TutorActiveSessionScreen] Session subscription error:', err);
        setLoading(false);
      },
    );
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => {
      unsub?.();
      clearTimeout(timer);
    };
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
      (err) => console.warn('[TutorActiveSessionScreen] Request subscription error:', err),
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

  // Grace periods and verification PIN
  const arrivalGraceEndsAt = Number(
    session?.arrivalGraceEndsAt
    || request?.arrivalGraceEndsAt
    || 0
  );
  const remainingArrivalGraceMs = Math.max(0, arrivalGraceEndsAt - now);

  const prepGraceEndsAt = Number(
    session?.preparationGraceEndsAt
    || request?.preparationGraceEndsAt
    || 0
  );
  const remainingPrepGraceMs = Math.max(0, prepGraceEndsAt - now);

  const isPinVerified = Boolean(
    session?.pinVerified
    || request?.pinVerified
    || session?.meetingConfirmed
    || request?.meetingConfirmed
  );
  const verificationPin = String(
    request?.verificationPin
    || session?.verificationPin
    || ''
  ).trim();

  const safety = useMemo(() => {
    return extractSafetySnapshot(session || request);
  }, [session, request]);

  const handleStartLesson = async () => {
    if (isStartingLesson) return;
    setIsStartingLesson(true);
    try {
      await startInPersonLesson({
        requestId: effectiveRequestId,
        sessionId: session?.id || sessionId,
      });
    } catch (err) {
      Alert.alert('Error', err?.message || 'Unable to start lesson.');
    } finally {
      setIsStartingLesson(false);
    }
  };

  // Auto-start when 5-minute preparation grace window expires
  useEffect(() => {
    if (
      sessionStatus === 'preparing_for_lesson'
      && prepGraceEndsAt > 0
      && now >= prepGraceEndsAt
      && !hasAutoStartedRef.current
    ) {
      hasAutoStartedRef.current = true;
      handleStartLesson();
    }
  }, [now, prepGraceEndsAt, sessionStatus]);

  useEffect(() => {
    if (isTerminal && session && !hasNavigatedSummaryRef.current) {
      hasNavigatedSummaryRef.current = true;
      navigate?.('TutorSessionSummary', {
        sessionId: session.id || sessionId,
        session,
        requestId: effectiveRequestId,
        request,
      });
    }
  }, [effectiveRequestId, isTerminal, navigate, request, session, sessionId]);

  // Calculate elapsed time (billing clock runs only when session is active)
  const sessionStartMs = useMemo(() => {
    if (!isSessionActive) return 0;
    return Number(
      session?.billingStartedAt
      || session?.startedAt
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

  // Live estimated running total (Tutor payout = 73% lesson tuition + 100% travel fee)
  const ratePerMinute = Number(
    session?.pricingSnapshot?.adjustedRatePerMinute
    ?? session?.pricingSnapshot?.ratePerMinute
    ?? request?.pricingSnapshot?.adjustedRatePerMinute
    ?? request?.pricingSnapshot?.ratePerMinute
    ?? 3.6,
  );
  const basePrice = Number(
    session?.pricingSnapshot?.adjustedBaseAmount
    ?? session?.pricingSnapshot?.baseAmount
    ?? request?.pricingSnapshot?.adjustedBaseAmount
    ?? request?.pricingSnapshot?.baseAmount
    ?? 7,
  );
  const travelDistanceKm = Number(session?.distanceKm || request?.distanceKm || 0);
  const travelFee = Number(
    session?.pricingSnapshot?.transferFee
    ?? session?.pricingSnapshot?.travelFee
    ?? request?.pricingSnapshot?.transferFee
    ?? request?.pricingSnapshot?.travelFee
    ?? computeTravelFee(travelDistanceKm),
  );
  const currentMinutesAttended = isSessionActive ? Math.max(1, Math.ceil(elapsedSeconds / 60)) : 0;
  const currentLessonTuition = isSessionActive
    ? Number((basePrice + (currentMinutesAttended * ratePerMinute)).toFixed(2))
    : 0;
  const tutorTuitionEarnings = Number((currentLessonTuition * TUTOR_PAYOUT_RATE).toFixed(2));
  const tutorTotalEarnings = isSessionActive
    ? Number((tutorTuitionEarnings + travelFee).toFixed(2))
    : travelFee;
  const currentLessonCost = Number((currentMinutesAttended * ratePerMinute).toFixed(2));
  const runningTotalEstimate = currentLessonCost + travelFee;

  // Student metadata
  const studentName = session?.studentName || request?.studentName || 'Student';
  const studentInitial = studentName.charAt(0).toUpperCase();
  const studentPhoto = session?.studentPhoto || request?.studentPhoto || null;
  const studentPhone = session?.studentPhone || request?.studentPhone || '';
  const studentRating = Number(session?.studentRating || request?.studentRating || 5.0);
  const studentGrade = session?.studentGrade || request?.studentGrade || request?.grade || '';
  const subject = session?.subject || request?.subject || 'Mathematics';
  const topic = session?.topic || request?.topic || 'Lesson In Progress';
  const description = request?.description || session?.description || '';

  // Two-party handshake states (Phase 16)
  const isEndRequested = session?.status === 'ending_requested';
  const isEndRequestedByMe = isEndRequested && session?.endRequestedBy === user?.uid;
  const isEndRequestedByStudent = isEndRequested && session?.endRequestedBy && session?.endRequestedBy !== user?.uid;

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

  // Tutor requests end lesson (Phase 16 handshake)
  const handleEndSession = () => {
    Alert.alert(
      'Request End of Lesson?',
      `Request student confirmation to finish lesson? Billable time will be ${currentMinutesAttended} mins.`,
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

  // Tutor confirms student's end request (Phase 16 handshake)
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
      navigate?.('TutorSessionSummary', {
        sessionId: currentSession.id,
        session: closedSession || currentSession,
        requestId: effectiveRequestId,
        request,
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
        canceledBy: 'tutor',
        canceledReason: reason || 'Tutor safety concern',
      });
      hasNavigatedSummaryRef.current = true;
      navigate?.('TutorSessionSummary', {
        sessionId: currentSession.id,
        session: closedSession || currentSession,
        requestId: effectiveRequestId,
        request,
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
        canceledBy: 'tutor',
        canceledReason: payload?.reason || 'Canceled by tutor request',
      });
      hasNavigatedSummaryRef.current = true;
      navigate?.('TutorSessionSummary', {
        sessionId: currentSession.id,
        session: closedSession || currentSession,
        requestId: effectiveRequestId,
        request,
      });
    } catch (err) {
      console.warn('handleConfirmCancel error:', err);
    }
  };

  const handleShareLiveSession = async () => {
    try {
      const guardianPart = safety?.guardianName
        ? ` Guardian: ${safety.guardianName} (${safety.guardianPhone || 'on file'}).`
        : '';
      await Share.share({
        title: 'Parakleo In-Person Lesson',
        message: `I am currently conducting an in-person tutoring session for ${subject} with ${studentName} via Parakleo. Elapsed time: ${formatTimer(elapsedSeconds)}.${guardianPart}`,
      });
    } catch (_err) {}
  };

  const handleCallGuardian = () => {
    if (safety?.guardianPhone) {
      Linking.openURL(`tel:${safety.guardianPhone}`).catch(() => {
        Alert.alert('Notice', 'Phone dialer could not be opened.');
      });
    } else {
      Alert.alert('Notice', 'Guardian phone number is not available.');
    }
  };

  const handleCallStudent = () => {
    if (studentPhone) {
      Linking.openURL(`tel:${studentPhone}`).catch(() => {
        Alert.alert('Notice', 'Phone dialer could not be opened.');
      });
    } else {
      Alert.alert('Notice', 'Student phone number is not available.');
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
          {/* Guardian Safety Reminder (REQ-011) */}
          {(safety.isMinor || safety.guardianPresenceRequired) ? (
            <View style={styles.guardianSafetyCard}>
              <View style={styles.guardianSafetyHeaderRow}>
                <Ionicons name="shield-checkmark" size={20} color="#d97706" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.guardianSafetyTitle}>
                    {safety.isMinor ? 'Minor Learner • Guardian Required' : 'Guardian Presence Required'}
                  </Text>
                  <Text style={styles.guardianSafetySubtitle}>
                    A parent or guardian {safety.guardianName ? `(${safety.guardianName}) ` : ''}must remain present for the entire in-person session. Do not conduct the lesson unattended.
                  </Text>
                </View>
              </View>
              {safety.guardianPhone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCallGuardian}
                  style={styles.guardianSafetyCallBtn}
                >
                  <Ionicons name="call" size={14} color="#b45309" />
                  <Text style={styles.guardianSafetyCallText}>Call Guardian: {safety.guardianPhone}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* PIN Presentation Card (Milestone M4 / M5) */}
          {!isPinVerified && ['arrived', 'waiting_student', 'preparing_for_lesson'].includes(sessionStatus) ? (
            <View style={styles.pinDisplayCard}>
              <View style={styles.pinHeaderRow}>
                <Ionicons name="keypad" size={20} color="#059669" />
                <Text style={styles.pinHeaderTitle}>ONE-TIME MEETING PIN</Text>
              </View>
              <Text style={styles.pinInstructionText}>
                Show this 4-digit code to {studentName} to verify physical arrival:
              </Text>
              <View style={styles.pinBoxesRow}>
                {(verificationPin || '----').split('').slice(0, 4).map((digit, idx) => (
                  <View key={idx} style={styles.pinBox}>
                    <Text style={styles.pinBoxDigit}>{digit}</Text>
                  </View>
                ))}
              </View>
              {remainingArrivalGraceMs > 0 ? (
                <Text style={styles.pinGraceHint}>
                  Arrival Grace: {formatGraceCountdown(remainingArrivalGraceMs)} remaining
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Preparation Grace & Start Lesson Card (Milestone M5) */}
          {sessionStatus === 'preparing_for_lesson' ? (
            <View style={styles.prepGraceCard}>
              <View style={styles.prepGraceHeaderRow}>
                <Ionicons name="book-outline" size={20} color="#7c3aed" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.prepGraceTitle}>Preparation Grace Active</Text>
                  <Text style={styles.prepGraceCountdown}>
                    {formatGraceCountdown(remainingPrepGraceMs)} remaining
                  </Text>
                </View>
              </View>
              <Text style={styles.prepGraceSubtitle}>
                Take time to set up study materials. Billing begins when either user taps Start Lesson or when grace expires.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleStartLesson}
                disabled={isStartingLesson}
                style={styles.startLessonButton}
              >
                {isStartingLesson ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#ffffff" />
                    <Text style={styles.startLessonButtonText}>Start Lesson Now</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* 1. Hero Live Timer Card */}
          <View style={styles.timerCard}>
            <View style={styles.liveBadgeRow}>
              <View style={styles.liveIndicatorPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveIndicatorText}>
                  {!isPinVerified
                    ? 'MEETING UNVERIFIED'
                    : sessionStatus === 'preparing_for_lesson'
                      ? 'PREPARING FOR LESSON'
                      : isSessionPaused
                        ? 'LESSON PAUSED'
                        : 'IN SESSION • ACTIVE'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={handleTogglePause}
                disabled={isPausing || !isSessionActive}
                style={[
                  styles.pausePillButton,
                  isSessionPaused ? styles.resumePillButton : styles.pausePillButtonNormal,
                  !isSessionActive && styles.buttonDisabled,
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
                {formatCurrency(ratePerMinute)}/min
              </Text>
            </View>
          </View>

          {/* 2. Live Running Earnings Card */}
          <View style={styles.costEstimateCard}>
            <View style={styles.costEstimateHeader}>
              <View style={styles.costIconWrap}>
                <Ionicons name="wallet-outline" size={18} color="#059669" />
              </View>
              <View style={styles.costHeaderTexts}>
                <Text style={styles.costHeaderTitle}>Your Estimated Earnings</Text>
                <Text style={styles.costHeaderSubtitle}>
                  73% tuition ({formatCurrency(tutorTuitionEarnings)}) + 100% travel ({formatCurrency(travelFee)})
                </Text>
              </View>
              <Text style={styles.costTotalNumber}>
                {formatCurrency(tutorTotalEarnings)}
              </Text>
            </View>
          </View>

          {/* 3. Student Information Card */}
          <View style={styles.counterpartCard}>
            <View style={styles.counterpartTopRow}>
              {studentPhoto ? (
                <Image source={{ uri: studentPhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{studentInitial}</Text>
                </View>
              )}

              <View style={styles.counterpartDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.counterpartName} numberOfLines={1}>
                    {studentName}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text style={styles.ratingValue}>{studentRating.toFixed(1)}</Text>
                  </View>
                  {studentGrade ? (
                    <Text style={styles.gradeBadge}>{studentGrade}</Text>
                  ) : (
                    <Text style={styles.gradeBadge}>{subject}</Text>
                  )}
                </View>
              </View>

              {studentPhone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCallStudent}
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

          {/* Handshake Prompt: Student Requested End (Phase 16) */}
          {isEndRequestedByStudent && (
            <View style={styles.handshakeCard}>
              <View style={styles.handshakeIconWrap}>
                <Ionicons name="checkmark-done-circle" size={24} color="#059669" />
              </View>
              <View style={styles.handshakeTextWrap}>
                <Text style={styles.handshakeTitle}>Student Finished Lesson</Text>
                <Text style={styles.handshakeSubtitle}>
                  {studentName} requested to complete this lesson ({currentMinutesAttended} min). Please confirm to settle.
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

          {/* Handshake Status: Tutor Requested End (Phase 16) */}
          {isEndRequestedByMe && (
            <View style={[styles.handshakeCard, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
              <View style={[styles.handshakeIconWrap, { backgroundColor: '#ccfbf1' }]}>
                <Ionicons name="hourglass-outline" size={20} color="#0f766e" />
              </View>
              <View style={styles.handshakeTextWrap}>
                <Text style={[styles.handshakeTitle, { color: '#0f766e' }]}>Awaiting Student Confirmation</Text>
                <Text style={[styles.handshakeSubtitle, { color: '#115e59' }]}>
                  You requested to finish the lesson. Waiting for {studentName} to confirm.
                </Text>
              </View>
            </View>
          )}

          {/* 5. In-Person Learning Checklist / Tips */}
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>In-Person Session Tips</Text>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>Guide student through step-by-step problem solutions</Text>
            </View>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>Ask student to explain key concepts back to you</Text>
            </View>
            <View style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              <Text style={styles.checklistText}>You will rate your student when this session finishes</Text>
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
                    {isEndRequestedByMe ? 'Awaiting Student Confirmation...' : 'End Lesson & Settle'}
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
          role="tutor"
          userRole="tutor"
          partnerName={studentName}
          onInstantCancel={handleCancelForSafety}
          safetySnapshot={safety}
          guardianPhone={safety.guardianPhone}
          guardianName={safety.guardianName}
        />

        {/* Cancellation Quote Modal (Phase 17) */}
        <CancellationQuoteModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          sessionId={session?.id || sessionId}
          requestId={effectiveRequestId}
          role="tutor"
          status={session?.status || 'in_session'}
          onConfirmCancel={handleConfirmCancel}
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
  counterpartCard: {
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
  counterpartTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  counterpartDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  counterpartName: {
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
  metaRow: {
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
  gradeBadge: {
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
  pinDisplayCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pinHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.8,
  },
  pinInstructionText: {
    fontSize: 13,
    color: '#047857',
    textAlign: 'center',
    marginBottom: 14,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 10,
  },
  pinBox: {
    width: 52,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pinBoxDigit: {
    fontSize: 28,
    fontWeight: '800',
    color: '#064e3b',
  },
  pinGraceHint: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    marginTop: 4,
  },
  guardianSafetyCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  guardianSafetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guardianSafetyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2,
  },
  guardianSafetySubtitle: {
    fontSize: 12,
    color: '#b45309',
    lineHeight: 16,
    fontWeight: '500',
  },
  guardianSafetyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  guardianSafetyCallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  prepGraceCard: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  prepGraceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prepGraceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6d28d9',
  },
  prepGraceCountdown: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7c3aed',
    marginTop: 1,
  },
  prepGraceSubtitle: {
    fontSize: 12,
    color: '#6d28d9',
    lineHeight: 16,
    marginBottom: 14,
  },
  startLessonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  startLessonButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
