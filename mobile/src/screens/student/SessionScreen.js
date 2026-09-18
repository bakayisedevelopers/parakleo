import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SessionMapView } from '../../components/student/SessionMapView';
import { useAuth } from '../../context/AuthContext';
import { useSubjectCatalog } from '../../hooks/useSubjectCatalog';
import {
  createClassRequest,
  subscribeToRequestById,
  subscribeToStudentRequests,
} from '../../services/classRequestService';
import { subscribeToLiveTracking, updateLiveTracking } from '../../services/liveTrackingRealtimeService';
import { getBestAvailableLocation, resolveLocationFromOption, saveUserLiveLocation } from '../../services/locationService';
import { fetchPricingQuote } from '../../services/pricingService';
import { uploadUserFile } from '../../services/storageService';
import { cancelInPersonSession } from '../../services/sessionService';
import { buildSafetySnapshot } from '../../constants/safety';
import { SafetySupportModal } from '../../components/common/SafetySupportModal';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { PinVerificationModal } from '../../components/student/PinVerificationModal';
import { colors } from '../../theme/colors';
import {
  DEFAULT_LESSON_DURATION,
  formatRand,
  LESSON_DURATION_OPTIONS,
  computeTravelFee,
  computeBookingFee,
  normalizePricingSnapshot,
  LEGACY_SAFE_PRICING_SNAPSHOT,
} from '../../utils/pricing';

function formatGraceCountdown(remainingMs) {
  const totalSecs = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const QUALIFIED_TUTOR_SUBJECTS = [
  'Mathematics',
  'Maths Literacy',
  'Physical Sciences',
  'Accounting',
  'Life Sciences',
  'Business Studies',
  'English',
];

const STATUS_RANK = {
  // Terminal / Final
  canceled: 100,
  canceled_by_tutor: 100,
  canceled_by_student: 100,
  canceled_during: 100,
  cancelled: 100,
  completed: 100,
  settled: 100,
  expired: 100,
  closed: 100,
  // Lesson active
  in_session: 80,
  in_progress: 80,
  ending_requested: 75,
  // Preparation grace (PIN verified)
  preparing_for_lesson: 60,
  // Arrived / waiting for PIN
  arrived: 50,
  waiting_student: 50,
  // En route
  travelling: 40,
  traveling: 40,
  in_transit: 40,
  // Accepted
  accepted: 30,
  tutor_accepted: 30,
  tutor_assigned: 30,
  // Offered
  offered: 20,
  // Matching
  no_tutor_available: 12,
  matching: 10,
  pending: 10,
};

function resolveEffectiveStatus(...candidates) {
  let highestStatus = '';
  let highestRank = -1;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase();
    const rank = STATUS_RANK[normalized] ?? 0;
    if (rank > highestRank) {
      highestRank = rank;
      highestStatus = normalized;
    }
  }

  return highestStatus || 'matching';
}

function getRequestStatusUi(statusOrRequest = null, currentRequest = null, liveTracking = null) {
  let rawStatus = '';
  if (typeof statusOrRequest === 'string' && statusOrRequest.trim()) {
    rawStatus = statusOrRequest.trim();
  } else if (statusOrRequest?.status) {
    rawStatus = statusOrRequest.status;
  } else if (currentRequest?.status) {
    rawStatus = currentRequest.status;
  } else if (liveTracking?.status) {
    rawStatus = liveTracking.status;
  }
  const normalized = String(rawStatus || 'matching').toLowerCase();

  if (['pending', 'matching'].includes(normalized)) {
    return {
      icon: 'search',
      title: 'Looking for a tutor',
      subtitle: 'We are checking nearby verified tutors for this subject.',
      badge: 'Searching',
      tone: '#059669',
    };
  }

  if (normalized === 'offered') {
    return {
      icon: 'timer-outline',
      title: 'Tutor found',
      subtitle: 'Waiting for the tutor to accept your request.',
      badge: 'Waiting for acceptance',
      tone: '#7c3aed',
    };
  }

  if (['accepted', 'tutor_accepted', 'tutor_assigned'].includes(normalized)) {
    return {
      icon: 'car-sport-outline',
      title: 'Tutor accepted',
      subtitle: 'Your tutor accepted the request and is preparing to travel.',
      badge: 'Tutor accepted',
      tone: '#0f766e',
    };
  }

  if (['traveling', 'travelling', 'in_transit'].includes(normalized)) {
    return {
      icon: 'car-sport',
      title: 'Tutor en route',
      subtitle: 'Your tutor is travelling to your location.',
      badge: 'Tutor travelling',
      tone: '#0f766e',
    };
  }

  if (['arrived', 'waiting_student'].includes(normalized)) {
    return {
      icon: 'location',
      title: 'Tutor has arrived',
      subtitle: 'Your tutor has reached your meeting location. 5-minute arrival grace active.',
      badge: 'Tutor arrived',
      tone: '#2563eb',
    };
  }

  if (normalized === 'preparing_for_lesson') {
    return {
      icon: 'book-outline',
      title: 'Preparing for lesson',
      subtitle: 'Your tutor is setting up study materials. Lesson will begin shortly.',
      badge: 'Preparing',
      tone: '#7c3aed',
    };
  }

  if (normalized === 'ending_requested') {
    return {
      icon: 'flag-outline',
      title: 'Lesson ending requested',
      subtitle: 'Please review and confirm to complete your lesson.',
      badge: 'Ending handshake',
      tone: '#d97706',
    };
  }

  if (['in_progress', 'in_session', 'active'].includes(normalized)) {
    return {
      icon: 'time',
      title: 'Lesson in progress',
      subtitle: 'Your tutoring session is currently active.',
      badge: 'In session',
      tone: '#059669',
    };
  }

  if (['completed', 'settled'].includes(normalized)) {
    return {
      icon: 'checkmark-done-circle',
      title: 'Lesson completed',
      subtitle: 'Your lesson has ended. View summary and rate your tutor.',
      badge: 'Completed',
      tone: '#059669',
    };
  }

  if (normalized === 'no_tutor_available') {
    return {
      icon: 'alert-circle-outline',
      title: 'Still searching',
      subtitle: 'No tutor accepted yet. We will keep trying when another tutor is available.',
      badge: 'Retrying',
      tone: '#d97706',
    };
  }

  if (['canceled', 'canceled_during', 'canceled_by_tutor', 'canceled_by_student', 'cancelled', 'expired', 'closed'].includes(normalized)) {
    return {
      icon: 'close-circle-outline',
      title: 'Request closed',
      subtitle: currentRequest?.statusDetail || liveTracking?.statusDetail || 'This request is no longer active.',
      badge: 'Closed',
      tone: '#e11d48',
    };
  }

  return {
    icon: 'checkmark-circle-outline',
    title: 'Request created',
    subtitle: 'Preparing your request status.',
    badge: 'Created',
    tone: '#64748b',
  };
}

function formatDistance(distanceMeters) {
  const numeric = Number(distanceMeters);
  if (!Number.isFinite(numeric) || numeric <= 0) return '4.2 km';
  if (numeric < 1000) return `${Math.round(numeric)} m`;
  return `${(numeric / 1000).toFixed(1)} km`;
}

function formatEta(etaSeconds) {
  const numeric = Number(etaSeconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return '12 min';
  return `${Math.max(1, Math.ceil(numeric / 60))} min`;
}

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

export function SessionScreen({ navigate, goBack, route, sessions = [] }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const { subjectOptions } = useSubjectCatalog();

  const incomingRequestId = String(params.requestId || params.activeRequestId || params.id || '').trim();
  const initialSubject = params.subject || 'Mathematics';
  const initialTopic = params.topic || 'General lesson assistance';
  const initialDuration = Number(params.durationMinutes || params.estimatedMinutes || DEFAULT_LESSON_DURATION);
  const freeMinutesRemaining = Number(user?.freeMinutesRemaining || 0);
  const syncedParamsRef = useRef({
    subject: initialSubject,
    durationMinutes: initialDuration,
  });
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [selectedDuration, setSelectedDuration] = useState(initialDuration);
  const [quote, setQuote] = useState(
    params.quote
      ? normalizePricingSnapshot(params.quote)
      : normalizePricingSnapshot(LEGACY_SAFE_PRICING_SNAPSHOT)
  );
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);

  const paymentMethods = useMemo(() => Array.isArray(user?.paymentMethods) ? user.paymentMethods : [], [user?.paymentMethods]);
  const defaultMethod = paymentMethods.find((m) => m.isDefault) || paymentMethods[0] || null;
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod?.id || 'cash');

  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isDurationPickerOpen, setIsDurationPickerOpen] = useState(false);
  const [isPaymentPickerOpen, setIsPaymentPickerOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeRequestId, setActiveRequestId] = useState(incomingRequestId);
  const [activeRequest, setActiveRequest] = useState(params.request || null);
  const [liveTracking, setLiveTracking] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [bottomCardHeight, setBottomCardHeight] = useState(580);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const studentHomeAddress = String(user?.homeAddress || user?.address || '').trim();
  const hasHomeAddress = Boolean(studentHomeAddress);
  const locationOptions = useMemo(() => {
    if (hasHomeAddress) {
      return ['My Location', 'Home', 'Other'];
    }
    return ['My Location', 'Other'];
  }, [hasHomeAddress]);

  const [locationOption, setLocationOption] = useState('My Location');
  const [customAddress, setCustomAddress] = useState('');

  useEffect(() => {
    if (locationOption === 'Home' && !hasHomeAddress) {
      setLocationOption('My Location');
    }
  }, [hasHomeAddress, locationOption]);

  // Active tutor qualified subjects filtered from catalog or defaults
  const availableSubjects = useMemo(() => {
    const catalogNames = new Set(subjectOptions.map((s) => s.value.toLowerCase()));
    if (!catalogNames.size) return QUALIFIED_TUTOR_SUBJECTS;
    return QUALIFIED_TUTOR_SUBJECTS.filter((sub) => catalogNames.has(sub.toLowerCase()));
  }, [subjectOptions]);

  // Dynamic pricing calculation
  const ratePerMinute = Number(quote?.adjustedRatePerMinute ?? quote?.ratePerMinute ?? LEGACY_SAFE_PRICING_SNAPSHOT.adjustedRatePerMinute);
  const basePrice = Number(quote?.adjustedBaseAmount ?? quote?.baseAmount ?? LEGACY_SAFE_PRICING_SNAPSHOT.adjustedBaseAmount);
  const rawLessonCost = Number(quote?.totalAmount ?? (basePrice + (selectedDuration * ratePerMinute)));
  const travelFee = Number(quote?.transferFee ?? quote?.travelFee ?? computeTravelFee(0));
  const bookingFee = Number(quote?.bookingFee ?? quote?.bookingFeeAmount ?? computeBookingFee(rawLessonCost));
  const rawTotalAmount = Number((rawLessonCost + travelFee + bookingFee).toFixed(2));

  // Free minutes calculation
  const freeMinutesQualify = freeMinutesRemaining >= selectedDuration;
  const freeMinutesPartial = !freeMinutesQualify && freeMinutesRemaining > 0;
  const freeMinutesDiscount = freeMinutesQualify
    ? rawTotalAmount
    : freeMinutesPartial
      ? Number(((freeMinutesRemaining / selectedDuration) * rawLessonCost).toFixed(2))
      : 0;

  const finalAmount = Math.max(0, Number((rawTotalAmount - freeMinutesDiscount).toFixed(2)));
  const isFree = finalAmount === 0;

  // Selected payment details
  const activePaymentMethod = useMemo(() => {
    if (selectedMethodId === 'cash') {
      return { id: 'cash', brand: 'Cash', last4: 'Cash', isCash: true };
    }
    return paymentMethods.find((card) => card.id === selectedMethodId) || {
      id: 'cash',
      brand: 'Cash',
      last4: 'Cash',
      isCash: true,
    };
  }, [selectedMethodId, paymentMethods]);

  // Load quote on mount if missing, or when duration/subject change (only if no active request)
  useEffect(() => {
    if (activeRequestId) return;
    let isCurrent = true;
    async function updateQuote() {
      try {
        setIsRefreshingQuote(true);
        const nextQuote = await fetchPricingQuote({
          durationMinutes: selectedDuration,
          subject: selectedSubject,
        });
        if (isCurrent && nextQuote) {
          setQuote(nextQuote);
        }
      } catch (_err) {
        // Fallback uses legacy quote snapshot so quote is never null
        if (isCurrent) {
          setQuote((prevQuote) => prevQuote || normalizePricingSnapshot(LEGACY_SAFE_PRICING_SNAPSHOT));
        }
      } finally {
        setIsRefreshingQuote(false);
      }
    }
    updateQuote();
    return () => {
      isCurrent = false;
      setIsRefreshingQuote(false);
    };
  }, [activeRequestId, selectedDuration, selectedSubject]);

  // Synchronize pricing quote from activeRequest if available
  useEffect(() => {
    if (activeRequest?.pricingSnapshot) {
      setQuote(normalizePricingSnapshot(activeRequest.pricingSnapshot));
    }
  }, [activeRequest?.pricingSnapshot]);

  // Synchronize route params if updated after mount
  useEffect(() => {
    const nextRequestId = String(params.requestId || params.activeRequestId || params.id || '').trim();
    if (nextRequestId && nextRequestId !== activeRequestId) {
      setActiveRequestId(nextRequestId);
    }
    if (params.request) {
      setActiveRequest((prev) => {
        if (!prev) return params.request;
        if (params.request.id !== prev.id || params.request.status !== prev.status) {
          return params.request;
        }
        return prev;
      });
    }
    if (params.subject && params.subject !== syncedParamsRef.current.subject) {
      syncedParamsRef.current.subject = params.subject;
      setSelectedSubject(params.subject);
    }
    const nextDuration = Number(params.durationMinutes || params.estimatedMinutes || 0);
    if (nextDuration > 0 && nextDuration !== syncedParamsRef.current.durationMinutes) {
      syncedParamsRef.current.durationMinutes = nextDuration;
      setSelectedDuration(nextDuration);
    }
  }, [params.requestId, params.activeRequestId, params.id, params.request?.id, params.request?.status, params.subject, params.durationMinutes, params.estimatedMinutes, activeRequestId]);

  // Auto-bind active request if student opens session screen with an ongoing request
  useEffect(() => {
    if (activeRequestId || !user?.uid) return undefined;
    if (params.attachments?.length || params.isNewRequest) return undefined;

    return subscribeToStudentRequests(
      user.uid,
      (reqs) => {
        if (!reqs || !reqs.length) return;
        const active = reqs.find((r) =>
          ['pending', 'matching', 'offered', 'accepted', 'tutor_accepted', 'tutor_assigned', 'traveling', 'travelling', 'in_transit', 'arrived', 'waiting_student', 'preparing_for_lesson'].includes(
            String(r?.status || '').toLowerCase()
          )
        );
        if (active?.id) {
          setActiveRequestId(active.id);
          setActiveRequest(active);
        }
      },
      () => null
    );
  }, [activeRequestId, user?.uid, params.attachments, params.isNewRequest]);

  useEffect(() => {
    if (!activeRequestId) {
      setActiveRequest(null);
      return undefined;
    }

    return subscribeToRequestById(
      activeRequestId,
      (req) => {
        if (req) setActiveRequest(req);
      },
      (err) => console.warn('[SessionScreen] subscribeToRequestById warning:', err?.message || err),
    );
  }, [activeRequestId]);

  useEffect(() => {
    if (!activeRequestId) {
      setLiveTracking(null);
      return undefined;
    }

    return subscribeToLiveTracking(
      activeRequestId,
      (tracking) => {
        if (tracking) setLiveTracking(tracking);
      },
      (err) => console.warn('[SessionScreen] subscribeToLiveTracking warning:', err?.message || err),
    );
  }, [activeRequestId]);

  function handleClose() {
    if (goBack) {
      goBack('Dashboard');
    } else if (navigate) {
      navigate('Dashboard');
    }
  }

  function handleSelectSubject(subject) {
    setSelectedSubject(subject);
    setIsSubjectDropdownOpen(false);
  }

  function handleSelectDuration(minutes) {
    setSelectedDuration(Number(minutes));
    setIsDurationPickerOpen(false);
  }

  function handleSelectPayment(methodId) {
    setSelectedMethodId(methodId);
    setIsPaymentPickerOpen(false);
  }

  async function handleConfirmOrder() {
    setError('');
    if (locationOption === 'Other' && !customAddress.trim()) {
      setError('Please enter the address for your lesson.');
      return;
    }

    setIsSubmitting(true);
    try {
      const attachments = params.attachments || [];
      const uploadedAttachments = [];

      for (const attachment of attachments) {
        try {
          const uploadResult = await uploadUserFile({
            userId: user?.uid || 'guest',
            attachment,
            pathPrefix: 'request-attachments',
          });
          uploadedAttachments.push(uploadResult);
        } catch (_uploadError) {
          uploadedAttachments.push({
            downloadUrl: '',
            fileName: attachment.name || 'file',
            fileType: attachment.type || 'application/octet-stream',
          });
        }
      }

      let selectedLocationAddress = 'Current Location';
      if (locationOption === 'Home') {
        selectedLocationAddress = studentHomeAddress;
      } else if (locationOption === 'Other') {
        selectedLocationAddress = customAddress.trim();
      } else {
        selectedLocationAddress = user?.locationAddress || user?.address || 'Current Location';
      }

      const liveLocation = await getBestAvailableLocation(user).catch(() => user?.homeLocation || user?.location || null);
      await saveUserLiveLocation(user?.uid || '', liveLocation).catch(() => null);

      const meetingLocation = await resolveLocationFromOption(locationOption, {
        user,
        customAddress,
        studentHomeAddress,
      }).catch(() => liveLocation) || liveLocation;

      const safetySnapshot = buildSafetySnapshot(user);

      const requestId = await createClassRequest({
        studentId: user?.uid || '',
        studentName: user?.fullName || user?.displayName || 'Student',
        studentEmail: user?.email || '',
        topic: initialTopic,
        description: initialTopic,
        subject: selectedSubject,
        duration: `${selectedDuration} minutes`,
        durationMinutes: selectedDuration,
        imageAttachment: uploadedAttachments[0]?.downloadUrl || '',
        attachment: uploadedAttachments[0] || null,
        attachments: uploadedAttachments,
        selectedCardId: activePaymentMethod.isCash ? 'cash' : activePaymentMethod.id,
        paymentMethod: activePaymentMethod.isCash ? 'cash' : 'card',
        paymentMethodType: activePaymentMethod.isCash ? 'cash' : 'card',
        locationOption,
        meetingAddress: selectedLocationAddress,
        studentAddress: selectedLocationAddress,
        locationAddress: selectedLocationAddress,
        address: selectedLocationAddress,
        pricingSnapshot: {
          ...quote,
          baseAmount: basePrice,
          ratePerMinute,
          adjustedBaseAmount: basePrice,
          adjustedRatePerMinute: ratePerMinute,
          transferFee: travelFee,
          travelFee,
          travelFeeAmount: travelFee,
          bookingFee,
          bookingFeeAmount: bookingFee,
          lessonTuitionAmount: rawLessonCost,
          durationMinutes: selectedDuration,
          totalAmount: rawTotalAmount,
          finalPrice: finalAmount,
          isFree,
          currency: 'ZAR',
        },
        mode: 'in_person',
        studentLocation: meetingLocation,
        location: meetingLocation,
        destination: meetingLocation,
        meetingCoordinates: meetingLocation,
        studentLiveLocation: liveLocation,
        safetySnapshot,
        isMinor: safetySnapshot.isMinor,
        guardianPresenceRequired: safetySnapshot.guardianPresenceRequired,
        preferSameGenderTutor: safetySnapshot.preferSameGenderTutor,
        preferPublicMeetingPlace: safetySnapshot.preferPublicMeetingPlace,
      });

      await updateLiveTracking(requestId, {
        requestId,
        studentId: user?.uid || '',
        studentLocation: meetingLocation,
        destination: meetingLocation,
        meetingCoordinates: meetingLocation,
        studentLiveLocation: liveLocation,
        studentAddress: selectedLocationAddress,
        meetingAddress: selectedLocationAddress,
        locationOption,
        tutorLocation: null,
        mode: 'in_person',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }).catch((rtdbErr) => console.warn('[RTDB:live-tracking-in-person-error]', rtdbErr));

      setSubmissionSuccess(true);
      setActiveRequestId(requestId);
      setIsSubmitting(false);
    } catch (err) {
      setError(err.message || 'Unable to confirm order right now. Please try again.');
      setIsSubmitting(false);
    }
  }

  const currentRequest = activeRequest || (activeRequestId ? {
    id: activeRequestId,
    status: liveTracking?.status || 'matching',
    createdAtMs: liveTracking?.createdAtMs,
    requestExpiresAt: liveTracking?.requestExpiresAt,
  } : null);

  const matchingSession = useMemo(() => {
    if (!activeRequestId && !currentRequest?.id) return null;
    const targetId = activeRequestId || currentRequest?.id;
    return (sessions || []).find((s) => s?.id === targetId || s?.requestId === targetId || (currentRequest?.sessionId && s?.id === currentRequest.sessionId)) || null;
  }, [sessions, activeRequestId, currentRequest?.id, currentRequest?.sessionId]);

  const currentStatus = useMemo(() => {
    return resolveEffectiveStatus(
      liveTracking?.status,
      currentRequest?.status,
      matchingSession?.status,
    );
  }, [liveTracking?.status, currentRequest?.status, matchingSession?.status]);

  const statusUi = getRequestStatusUi(currentStatus, currentRequest, liveTracking);
  const hasLiveRequest = Boolean(activeRequestId);

  // 5-minute arrival grace countdown
  const arrivalGraceEndsAt = Number(
    currentRequest?.arrivalGraceEndsAt
    || currentRequest?.arrivalGraceEndsAtMs
    || liveTracking?.arrivalGraceEndsAt
    || liveTracking?.arrivalGraceEndsAtMs
    || (currentRequest?.arrivedAt ? currentRequest.arrivedAt + 5 * 60 * 1000 : 0)
    || (liveTracking?.arrivedAtMs ? liveTracking.arrivedAtMs + 5 * 60 * 1000 : 0)
  );
  const remainingArrivalGraceMs = arrivalGraceEndsAt ? Math.max(0, arrivalGraceEndsAt - now) : 0;

  // 5-minute preparation grace countdown
  const prepGraceEndsAt = Number(
    currentRequest?.preparationGraceEndsAt
    || currentRequest?.preparationGraceEndsAtMs
    || liveTracking?.preparationGraceEndsAt
    || liveTracking?.preparationGraceEndsAtMs
    || (currentRequest?.preparingStartedAt ? currentRequest.preparingStartedAt + 5 * 60 * 1000 : 0)
    || (liveTracking?.preparingStartedAtMs ? liveTracking.preparingStartedAtMs + 5 * 60 * 1000 : 0)
  );
  const remainingPrepGraceMs = prepGraceEndsAt ? Math.max(0, prepGraceEndsAt - now) : 0;

  // Auto-open PIN modal when tutor arrives
  const hasAutoOpenedPinRef = useRef(false);
  useEffect(() => {
    if (['arrived', 'waiting_student'].includes(currentStatus)) {
      const isPinVerified = Boolean(
        currentRequest?.pinVerified
        || liveTracking?.pinVerified
        || matchingSession?.pinVerified
        || currentRequest?.meetingConfirmed
        || liveTracking?.meetingConfirmed
        || matchingSession?.meetingConfirmed
      );
      if (!isPinVerified && !hasAutoOpenedPinRef.current) {
        hasAutoOpenedPinRef.current = true;
        setShowPinModal(true);
      }
    } else if (!['arrived', 'waiting_student', 'preparing_for_lesson'].includes(currentStatus)) {
      hasAutoOpenedPinRef.current = false;
    }
  }, [currentStatus, currentRequest?.pinVerified, liveTracking?.pinVerified, matchingSession?.pinVerified, currentRequest?.meetingConfirmed, liveTracking?.meetingConfirmed, matchingSession?.meetingConfirmed]);

  // Auto-navigate to ActiveSession when lesson is active
  useEffect(() => {
    if (['in_session', 'in_progress', 'ending_requested'].includes(currentStatus) && activeRequestId) {
      const effSessionId = matchingSession?.id || currentRequest?.sessionId || activeRequestId;
      navigate?.({
        key: 'ActiveSession',
        params: {
          sessionId: effSessionId,
          request: currentRequest || matchingSession,
          session: matchingSession,
          requestId: activeRequestId,
          parentTab: 'Dashboard',
        },
      });
    }
  }, [currentRequest, currentStatus, activeRequestId, matchingSession, navigate]);

  const handleCancelForSafety = async (reason) => {
    let didCancel = false;
    try {
      setShowSafetyModal(false);
      const effReason = reason || 'Student safety concern';
      if (activeRequestId) {
        await cancelInPersonSession({
          requestId: activeRequestId,
          sessionId: currentRequest?.sessionId || activeRequestId,
          session: currentRequest,
          canceledBy: 'student',
          reason: effReason,
        });
        didCancel = true;
      }
    } catch (err) {
      console.warn('handleCancelForSafety error:', err);
    } finally {
      if (didCancel) {
        setActiveRequestId('');
        setActiveRequest(null);
        setLiveTracking(null);
      }
      setShowSafetyModal(false);
      setShowCancelModal(false);
      if (didCancel) {
        setSubmissionSuccess(false);
        setIsSubmitting(false);
      }
    }
  };

  const handleConfirmCancel = async (payload) => {
    let didCancel = false;
    try {
      setShowCancelModal(false);
      const effReason = payload?.reason || 'Canceled by student';
      if (activeRequestId) {
        await cancelInPersonSession({
          requestId: activeRequestId,
          sessionId: currentRequest?.sessionId || activeRequestId,
          session: currentRequest,
          canceledBy: 'student',
          reason: effReason,
        });
        didCancel = true;
      }
    } catch (err) {
      console.warn('handleConfirmCancel error:', err);
    } finally {
      if (didCancel) {
        setActiveRequestId('');
        setActiveRequest(null);
        setLiveTracking(null);
      }
      setShowCancelModal(false);
      setShowSafetyModal(false);
      if (didCancel) {
        setSubmissionSuccess(false);
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelRequestPress = async () => {
    if (['pending', 'matching', 'offered', 'no_tutor_available'].includes(currentStatus)) {
      await handleConfirmCancel({ reason: 'Canceled by student before tutor accepted.' });
      return;
    }

    setShowCancelModal(true);
  };

  const showTutorTravelPlaceholder = [
    'accepted',
    'tutor_accepted',
    'tutor_assigned',
    'traveling',
    'travelling',
    'in_transit',
    'arrived',
    'waiting_student',
    'preparing_for_lesson',
    'in_progress',
    'in_session',
  ].includes(currentStatus);
  const tutorName = currentRequest?.tutorName || liveTracking?.tutorName || (currentStatus === 'offered' ? 'Matched tutor' : 'Your tutor');
  const tutorInitial = String(tutorName || 'Tutor').charAt(0).toUpperCase();
  const tutorRating = Number(currentRequest?.tutorRating || currentRequest?.tutorProfile?.overallRating || 4.8);

  return (
    <View style={styles.screen}>
      {/* 1. Top Map & Visual Section */}
      <View style={styles.topMapContainer}>
        {showTutorTravelPlaceholder ? (
          <View style={styles.mapLayerContainer} pointerEvents="box-none">
            <SessionMapView
              requestId={activeRequestId}
              studentLocation={
                liveTracking?.destination
                || liveTracking?.meetingCoordinates
                || currentRequest?.destination
                || currentRequest?.meetingCoordinates
                || liveTracking?.studentLocation
                || currentRequest?.studentLocation
                || user?.liveLocation
                || user?.homeLocation
                || user?.location
              }
              studentLocationName={
                currentRequest?.meetingAddress
                || liveTracking?.meetingAddress
                || currentRequest?.studentAddress
                || currentRequest?.locationAddress
                || 'Meeting location'
              }
              tutorName={tutorName}
              liveTracking={liveTracking}
              currentStatus={currentStatus}
            />
          </View>
        ) : (
          <View style={styles.requestReviewBackdrop} pointerEvents="none">
            <View style={styles.requestReviewIcon}>
              <Ionicons name="school-outline" size={34} color="#059669" />
            </View>
            <Text style={styles.requestReviewTitle}>Review your lesson details</Text>
            <Text style={styles.requestReviewSubtitle}>Confirm the details below when you are ready.</Text>
          </View>
        )}
      </View>

      {/* 2. Floating Top Container */}
      <View style={styles.topBarWrap} collapsable={false} pointerEvents="box-none">
        <View style={styles.topCard} pointerEvents="auto">
          {/* Close Button */}
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.topIconButton}
          >
            <Ionicons name="close" size={24} color="#0f172a" />
          </Pressable>

          {/* Highlighted Subject in Center */}
          <View style={styles.topSubjectWrap}>
            <View style={styles.topSubjectPill}>
              <View style={styles.topSubjectDot} />
              <Text style={styles.topSubjectText} numberOfLines={1}>
                {selectedSubject}
              </Text>
            </View>
          </View>

          {/* Edit Subject Plus Button (only when creating new request) / Safety Center Button (when live request active) */}
          {!hasLiveRequest ? (
            <Pressable
              accessibilityLabel="Edit subject"
              accessibilityRole="button"
              onPress={() => setIsSubjectDropdownOpen((curr) => !curr)}
              style={[styles.topIconButton, isSubjectDropdownOpen && styles.topIconButtonActive]}
            >
              <Ionicons name="add" size={24} color={isSubjectDropdownOpen ? '#059669' : '#0f172a'} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Safety Center"
              accessibilityRole="button"
              onPress={() => setShowSafetyModal(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.topIconButton}
            >
              <Ionicons name="shield-checkmark" size={20} color="#059669" />
            </Pressable>
          )}
        </View>

        {/* Subject Picker Dropdown Extension */}
        {isSubjectDropdownOpen ? (
          <View style={styles.subjectDropdownExtension}>
            <Text style={styles.subjectDropdownHeader}>Select qualified subject</Text>
            <ScrollView style={styles.subjectDropdownList} bounces={false}>
              {availableSubjects.map((sub) => {
                const isSelected = sub.toLowerCase() === selectedSubject.toLowerCase();
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={sub}
                    onPress={() => handleSelectSubject(sub)}
                    style={[styles.subjectDropdownOption, isSelected && styles.subjectDropdownOptionSelected]}
                  >
                    <Text style={[styles.subjectDropdownOptionText, isSelected && styles.subjectDropdownOptionTextSelected]}>
                      {sub}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark" size={18} color="#059669" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* 3. Bottom Sheet Card */}
      <View
        style={styles.bottomCard}
        collapsable={false}
        pointerEvents="auto"
      >
        {hasLiveRequest ? (
          <View style={styles.liveStatusPanel}>
            <View style={styles.liveStatusHeader}>
              <View style={[styles.liveStatusIcon, { backgroundColor: `${statusUi.tone}18` }]}>
                <Ionicons name={statusUi.icon} size={22} color={statusUi.tone} />
              </View>
              <View style={styles.liveStatusTextWrap}>
                <Text style={styles.liveStatusBadge}>{statusUi.badge}</Text>
                <Text style={styles.liveStatusTitle}>{statusUi.title}</Text>
                <Text style={styles.liveStatusSubtitle}>{statusUi.subtitle}</Text>
              </View>
            </View>

            {/* Arrival Grace Countdown (Phase 10) */}
            {['arrived', 'waiting_student'].includes(currentStatus) ? (
              <View style={styles.studentGraceBanner}>
                <Ionicons name="timer-outline" size={18} color="#2563eb" />
                <Text style={[styles.studentGraceText, { color: '#1d4ed8' }]}>
                  Arrival Grace:{' '}
                  <Text style={styles.studentGraceCountdown}>
                    {formatGraceCountdown(remainingArrivalGraceMs)}
                  </Text>{' '}
                  (Billing not started)
                </Text>
              </View>
            ) : null}

            {/* Preparation Grace Countdown (Phase 12) */}
            {currentStatus === 'preparing_for_lesson' ? (
              <View style={[styles.studentGraceBanner, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                <Ionicons name="book-outline" size={18} color="#7c3aed" />
                <Text style={[styles.studentGraceText, { color: '#6d28d9' }]}>
                  Preparation Grace:{' '}
                  <Text style={[styles.studentGraceCountdown, { color: '#6d28d9' }]}>
                    {formatGraceCountdown(remainingPrepGraceMs)}
                  </Text>{' '}
                  (Billing held)
                </Text>
              </View>
            ) : null}

            {/* Meeting PIN Verification (Milestone M5) */}
            {['arrived', 'waiting_student', 'preparing_for_lesson'].includes(currentStatus) ? (
              (() => {
                const isPinVerified = Boolean(
                  currentRequest?.pinVerified
                  || liveTracking?.pinVerified
                  || matchingSession?.pinVerified
                  || currentRequest?.meetingConfirmed
                  || liveTracking?.meetingConfirmed
                  || matchingSession?.meetingConfirmed
                );

                if (isPinVerified) {
                  return (
                    <View style={[styles.studentGraceBanner, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      <Text style={[styles.studentGraceText, { color: '#047857', fontWeight: '600' }]}>
                        Meeting Verified: Tutor code confirmed.
                      </Text>
                    </View>
                  );
                }

                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowPinModal(true)}
                    style={[styles.studentGraceBanner, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                  >
                    <Ionicons name="keypad" size={18} color="#2563eb" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.studentGraceText, { color: '#1d4ed8', fontWeight: '700' }]}>
                        Enter Meeting PIN
                      </Text>
                      <Text style={[styles.studentGraceText, { color: '#2563eb', fontSize: 12 }]}>
                        Ask your tutor for their 4-digit code to start the lesson.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#2563eb" />
                  </Pressable>
                );
              })()
            ) : null}

            {currentStatus === 'offered' || showTutorTravelPlaceholder ? (
              <View style={styles.matchedTutorCard}>
                <View style={styles.matchedTutorAvatar}>
                  <Text style={styles.matchedTutorAvatarText}>{tutorInitial}</Text>
                </View>
                <View style={styles.matchedTutorInfo}>
                  <Text style={styles.matchedTutorLabel}>Tutor</Text>
                  <Text style={styles.matchedTutorName}>{tutorName}</Text>
                  <Text style={styles.matchedTutorRating}>★ {tutorRating.toFixed(1)} rating</Text>
                </View>
                {['accepted', 'tutor_accepted', 'tutor_assigned', 'traveling', 'travelling', 'in_transit'].includes(currentStatus) ? (
                  <View style={styles.routeEstimateBox}>
                    <Text style={styles.routeEstimateValue}>{formatEta(liveTracking?.etaSeconds)}</Text>
                    <Text style={styles.routeEstimateLabel}>{formatDistance(liveTracking?.distanceRemainingMeters || liveTracking?.distanceMeters)}</Text>
                  </View>
                ) : ['arrived', 'waiting_student'].includes(currentStatus) ? (
                  <View style={[styles.routeEstimateBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                    <Text style={[styles.routeEstimateValue, { color: '#2563eb' }]}>Arrived</Text>
                    <Text style={styles.routeEstimateLabel}>At location</Text>
                  </View>
                ) : currentStatus === 'preparing_for_lesson' ? (
                  <View style={[styles.routeEstimateBox, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                    <Text style={[styles.routeEstimateValue, { color: '#7c3aed' }]}>Preparing</Text>
                    <Text style={styles.routeEstimateLabel}>Setting up</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Live Actions Row (Phases 17 & 21) */}
            <View style={styles.liveActionsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowSafetyModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.safetyPillButton}
              >
                <Ionicons name="shield-checkmark" size={18} color="#059669" />
                <Text style={styles.safetyPillText}>Safety Center</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleCancelRequestPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.cancelPillButton}
              >
                <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                <Text style={styles.cancelPillText}>Cancel Request</Text>
              </Pressable>
            </View>

            {['in_session', 'in_progress'].includes(currentStatus) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  navigate?.({
                    key: 'ActiveSession',
                    params: {
                      sessionId: currentRequest?.sessionId || activeRequestId,
                      request: currentRequest,
                      requestId: activeRequestId,
                      parentTab: 'Dashboard',
                    },
                  });
                }}
                style={styles.openActiveLessonButton}
              >
                <Ionicons name="time" size={18} color="#ffffff" />
                <Text style={styles.openActiveLessonText}>Open Live Session & Timer</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            ) : null}

            {['completed', 'settled'].includes(currentStatus) || (['canceled', 'canceled_during', 'canceled_by_tutor', 'canceled_by_student'].includes(currentStatus) && currentRequest?.tutorId) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  navigate?.({
                    key: 'SessionSummary',
                    params: {
                      sessionId: currentRequest?.sessionId || activeRequestId,
                      request: currentRequest,
                      requestId: activeRequestId,
                      parentTab: 'Dashboard',
                    },
                  });
                }}
                style={styles.openActiveLessonButton}
              >
                <Ionicons name="star" size={18} color="#ffffff" />
                <Text style={styles.openActiveLessonText}>View Summary & Rate Tutor</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            ) : null}

            {['canceled', 'canceled_during', 'canceled_by_tutor', 'canceled_by_student', 'expired', 'closed'].includes(currentStatus) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setActiveRequestId('');
                  setActiveRequest(null);
                  setLiveTracking(null);
                  setSubmissionSuccess(false);
                }}
                style={[styles.openActiveLessonButton, { backgroundColor: '#059669', marginTop: 10 }]}
              >
                <Ionicons name="refresh" size={18} color="#ffffff" />
                <Text style={styles.openActiveLessonText}>Dismiss & Book New Lesson</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Bolt-style Option Row */}
        <View style={[styles.optionRow, hasLiveRequest && styles.hidden]}>
          {/* Left Ride / Tutor Graphic */}
          <View style={styles.optionGraphicWrap}>
            <View style={styles.carGraphic}>
              <Ionicons name="car-sport" size={24} color="#059669" />
            </View>
          </View>

          {/* Center Details */}
          <View style={styles.optionDetails}>
            <Text style={styles.optionTitle}>{selectedSubject}</Text>

            {/* Time / Tutors Subrow */}
            <View style={styles.optionMetaRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select lesson duration"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => setIsDurationPickerOpen(true)}
                style={({ pressed }) => [styles.timePill, pressed && styles.pillPressed]}
              >
                <Text style={styles.timePillText}>{selectedDuration} min</Text>
                <Ionicons name="chevron-down" size={12} color="#059669" />
              </Pressable>

              <View style={styles.tutorCountBadge}>
                <Ionicons name="person" size={12} color="#64748b" />
                <Text style={styles.tutorCountText}>3 nearby</Text>
              </View>
            </View>

            {/* Topics (Everyday ride slot) */}
            <Text style={styles.optionTopics} numberOfLines={1}>
              {initialTopic}
            </Text>

            {/* Location Options replacing RECOMMENDED and FASTER badges */}
            <View style={styles.locationOptionRow}>
              {locationOptions.map((opt) => {
                const isSelected = locationOption === opt;
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${opt} location`}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    onPress={() => {
                      setLocationOption(opt);
                      if (error) setError('');
                    }}
                    style={({ pressed }) => [
                      styles.locationPill,
                      isSelected && styles.locationPillSelected,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.locationPillText,
                        isSelected && styles.locationPillTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Right Price Display */}
          <View style={styles.priceWrap}>
            {isFree ? (
              <View style={styles.freePriceWrap}>
                <Text style={styles.originalPriceStrikethrough}>
                  {formatRand(rawTotalAmount)}
                </Text>
                <Text style={styles.freePriceText}>R 0</Text>
              </View>
            ) : freeMinutesDiscount > 0 ? (
              <View style={styles.freePriceWrap}>
                <Text style={styles.originalPriceStrikethrough}>
                  {formatRand(rawTotalAmount)}
                </Text>
                <Text style={styles.priceAmount}>{formatRand(finalAmount)}</Text>
              </View>
            ) : (
              <Text style={styles.priceAmount}>{formatRand(finalAmount)}</Text>
            )}
            <View style={styles.priceHintRow}>
              {isRefreshingQuote ? <ActivityIndicator size="small" color="#059669" style={styles.priceRefreshingSpinner} /> : null}
              <Text style={styles.priceBreakdownHint}>incl. {formatRand(travelFee)} travel + {formatRand(bookingFee)} booking</Text>
            </View>
          </View>
        </View>

        {/* Custom Address Input (when 'Other' is selected) */}
        {!hasLiveRequest && locationOption === 'Other' ? (
          <View style={styles.customAddressWrap}>
            <View style={styles.customAddressHeader}>
              <Ionicons name="location" size={14} color="#059669" />
              <Text style={styles.customAddressLabel}>Lesson Address (Required)</Text>
            </View>
            <View style={styles.customAddressInputRow}>
              <TextInput
                style={styles.customAddressInput}
                placeholder="Type your meeting address..."
                placeholderTextColor="#94a3b8"
                value={customAddress}
                onChangeText={(val) => {
                  setCustomAddress(val);
                  if (error) setError('');
                }}
                autoCapitalize="words"
              />
              {customAddress ? (
                <Pressable onPress={() => setCustomAddress('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Home Address Display Hint (when 'Home' is selected) */}
        {!hasLiveRequest && locationOption === 'Home' ? (
          <View style={styles.homeAddressHintWrap}>
            <Ionicons name="home" size={13} color="#059669" />
            <Text style={styles.homeAddressHintText} numberOfLines={1}>
              Home: {studentHomeAddress}
            </Text>
          </View>
        ) : null}

        {/* Thin Divider */}
        <View style={[styles.divider, hasLiveRequest && styles.hidden]} />

        {/* Payment Method Selector Row */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsPaymentPickerOpen(true)}
          style={[styles.paymentMethodRow, hasLiveRequest && styles.hidden]}
        >
          <View style={styles.paymentMethodLeft}>
            <CardBrandBadge brand={activePaymentMethod.brand} size="small" />
            <Text style={styles.paymentMethodText}>
              {activePaymentMethod.isCash ? 'Cash' : `•••• ${activePaymentMethod.last4 || '----'}`}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#64748b" />
          </View>
          <Text style={styles.paymentMethodSub}>Personal payment</Text>
        </Pressable>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        {/* Confirm Order Button */}
        {(() => {
          const isConfirmDisabled = isSubmitting || (!quote && isRefreshingQuote) || Boolean(error) || rawTotalAmount <= 0;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={isConfirmDisabled}
              onPress={handleConfirmOrder}
              style={[
                styles.confirmButton,
                isConfirmDisabled && styles.confirmButtonDisabled,
                hasLiveRequest && styles.hidden,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : isRefreshingQuote && !quote ? (
                <View style={styles.confirmContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.confirmButtonText}>Updating quote...</Text>
                </View>
              ) : submissionSuccess ? (
                <View style={styles.confirmContent}>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.confirmButtonText}>Order Confirmed!</Text>
                </View>
              ) : (
                <Text style={styles.confirmButtonText}>Confirm order</Text>
              )}
            </Pressable>
          );
        })()}
      </View>

      {/* 4. Duration Selector Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isDurationPickerOpen}
        onRequestClose={() => setIsDurationPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.scrim} onPress={() => setIsDurationPickerOpen(false)} />
          <View style={styles.pickerModalSheet}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Lesson Duration</Text>
            <Text style={styles.modalSubtitle}>Select estimated time needed with tutor</Text>

            <ScrollView style={styles.modalOptionsList}>
              {LESSON_DURATION_OPTIONS.map((min) => {
                const isActive = min === selectedDuration;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={min}
                    onPress={() => handleSelectDuration(min)}
                    style={[styles.modalOptionRow, isActive && styles.modalOptionRowActive]}
                  >
                    <View style={styles.modalOptionLeft}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={isActive ? '#059669' : '#64748b'}
                      />
                      <Text style={[styles.modalOptionLabel, isActive && styles.modalOptionLabelActive]}>
                        {min} minutes
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, isActive && styles.radioOuterSelected]}>
                      {isActive ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsDurationPickerOpen(false)}
              style={styles.modalDoneButton}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 5. Payment Method Selector Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isPaymentPickerOpen}
        onRequestClose={() => setIsPaymentPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.scrim} onPress={() => setIsPaymentPickerOpen(false)} />
          <View style={styles.pickerModalSheet}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Payment Method</Text>
            <Text style={styles.modalSubtitle}>Select card or cash for this in-person session</Text>

            <ScrollView style={styles.modalOptionsList}>
              {/* Saved Cards */}
              {paymentMethods.map((card) => {
                const isSelected = selectedMethodId === card.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={card.id}
                    onPress={() => handleSelectPayment(card.id)}
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionRowActive]}
                  >
                    <View style={styles.modalOptionLeft}>
                      <CardBrandBadge brand={card.brand} size="large" />
                      <Text style={[styles.modalOptionLabel, isSelected && styles.modalOptionLabelActive]}>
                        •••• {card.last4 || '----'}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}

              {/* Cash Option at bottom */}
              <Pressable
                accessibilityRole="button"
                onPress={() => handleSelectPayment('cash')}
                style={[styles.modalOptionRow, selectedMethodId === 'cash' && styles.modalOptionRowActive]}
              >
                <View style={styles.modalOptionLeft}>
                  <CardBrandBadge brand="Cash" size="large" />
                  <Text style={[styles.modalOptionLabel, selectedMethodId === 'cash' && styles.modalOptionLabelActive]}>
                    Cash
                  </Text>
                </View>
                <View style={[styles.radioOuter, selectedMethodId === 'cash' && styles.radioOuterSelected]}>
                  {selectedMethodId === 'cash' ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsPaymentPickerOpen(false);
                if (navigate) navigate('Wallet');
              }}
              style={styles.managePaymentRow}
            >
              <Ionicons name="settings-outline" size={18} color="#059669" />
              <Text style={styles.managePaymentText}>Manage payment methods</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* Safety Center Modal (Phase 21) */}
      <SafetySupportModal
        visible={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        onCancelForSafety={handleCancelForSafety}
        userRole="student"
        currentLocationText={currentRequest?.studentAddress || currentRequest?.locationAddress || 'Your meeting location'}
      />

      {/* Cancellation Quote Modal (Phase 17) */}
      <CancellationQuoteModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={handleConfirmCancel}
        requestId={activeRequestId}
        sessionId={currentRequest?.sessionId || activeRequestId}
        currentStatus={currentStatus}
        userRole="student"
      />

      {/* 4-Digit PIN Verification Modal (Milestone M5) */}
      <PinVerificationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
        }}
        requestId={activeRequestId}
        sessionId={currentRequest?.sessionId || activeRequestId}
        tutorName={tutorName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ecfdf5',
    flex: 1,
  },
  topMapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapLayerContainer: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 108,
    paddingBottom: 24,
    justifyContent: 'center',
    alignItems: 'stretch',
    elevation: 0,
    zIndex: 0,
  },
  requestReviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    paddingBottom: 40,
    paddingHorizontal: 32,
    zIndex: 0,
  },
  requestReviewIcon: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#a7f3d0',
    borderRadius: 34,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  requestReviewTitle: {
    color: '#064e3b',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  requestReviewSubtitle: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  topBarWrap: {
    elevation: 210,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 48,
    zIndex: 210,
  },
  topCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 10,
  },
  topIconButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topIconButtonActive: {
    backgroundColor: '#ecfdf5',
  },
  topSubjectWrap: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  topSubjectPill: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topSubjectDot: {
    backgroundColor: '#10b981',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  topSubjectText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subjectDropdownExtension: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    elevation: 10,
    marginTop: 8,
    maxHeight: 220,
    overflow: 'hidden',
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  subjectDropdownHeader: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
  },
  subjectDropdownList: {
    maxHeight: 180,
  },
  subjectDropdownOption: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subjectDropdownOptionSelected: {
    backgroundColor: '#ecfdf5',
  },
  subjectDropdownOptionText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  subjectDropdownOptionTextSelected: {
    color: '#059669',
    fontWeight: '800',
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 200,
    zIndex: 200,
  },
  hidden: {
    display: 'none',
  },
  liveStatusPanel: {
    gap: 12,
  },
  liveStatusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  liveStatusIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  liveStatusTextWrap: {
    flex: 1,
    gap: 3,
  },
  liveStatusBadge: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  liveStatusTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  liveStatusSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  liveStatusDetail: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  matchedTutorCard: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  matchedTutorAvatar: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  matchedTutorAvatarText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  matchedTutorInfo: {
    flex: 1,
  },
  matchedTutorLabel: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  matchedTutorName: {
    color: '#064e3b',
    fontSize: 15,
    fontWeight: '900',
  },
  matchedTutorRating: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  routeEstimateBox: {
    alignItems: 'flex-end',
  },
  routeEstimateValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  routeEstimateLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  openActiveLessonButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#059669',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  openActiveLessonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  manageLiveRequestButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  manageLiveRequestText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '900',
  },
  optionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  optionGraphicWrap: {
    paddingTop: 2,
  },
  carGraphic: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  optionDetails: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  optionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  timePillText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  tutorCountBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tutorCountText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  optionTopics: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  locationOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  locationPill: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationPillSelected: {
    backgroundColor: '#059669',
  },
  locationPillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  locationPillTextSelected: {
    color: '#ffffff',
  },
  customAddressWrap: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
    padding: 10,
  },
  customAddressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  customAddressLabel: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  customAddressInputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customAddressInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  homeAddressHintWrap: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  homeAddressHintText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },
  priceWrap: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  priceAmount: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  freePriceWrap: {
    alignItems: 'flex-end',
  },
  originalPriceStrikethrough: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  freePriceText: {
    color: '#059669',
    fontSize: 22,
    fontWeight: '900',
  },
  priceHintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  priceRefreshingSpinner: {
    marginRight: 4,
  },
  priceBreakdownHint: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: '#f1f5f9',
    height: 1,
    marginVertical: 14,
  },
  paymentMethodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  paymentMethodLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentMethodSub: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  errorBanner: {
    color: '#e11d48',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#6ee7b7',
  },
  confirmContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    width: 36,
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
  pickerModalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '65%',
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalGrabber: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 14,
    marginTop: 2,
  },
  modalOptionsList: {
    marginBottom: 14,
  },
  modalOptionRow: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalOptionRowActive: {
    backgroundColor: '#f0fdf4',
  },
  modalOptionLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  modalOptionLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOptionLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioOuterSelected: {
    borderColor: '#059669',
  },
  radioInner: {
    backgroundColor: '#059669',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  modalDoneButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    height: 46,
    justifyContent: 'center',
    marginTop: 4,
  },
  modalDoneText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  managePaymentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  managePaymentText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  studentGraceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  studentGraceText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  studentGraceCountdown: {
    fontWeight: '800',
  },
  liveActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  safetyPillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
  },
  safetyPillText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelPillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
  },
  cancelPillText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
});
