import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { subscribeToRequestById } from '../../services/classRequestService';
import { subscribeToLiveTracking, updateLiveTracking } from '../../services/liveTrackingRealtimeService';
import { getBestAvailableLocation, getCurrentLocationSnapshot, normalizeLocation, saveUserLiveLocation } from '../../services/locationService';
import { fetchLiveRoute } from '../../services/directionsRouteService';
import { openExternalNavigation, openWazeNavigation } from '../../services/externalNavigationService';
import {
  cancelInPersonSession,
  markPreparingForLesson,
  markTutorArrived,
  startInPersonLesson,
  startTutorTravel,
} from '../../services/sessionService';
import { TravelRaceTrack } from '../../components/common/TravelRaceTrack';
import { SafetySupportModal } from '../../components/common/SafetySupportModal';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { useAuth } from '../../context/AuthContext';

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatGraceCountdown(remainingMs) {
  const totalSecs = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normalizeCoordinate(coordinate = null) {
  const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
  const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(coordinate?.accuracy)) ? Number(coordinate.accuracy) : null,
    altitude: Number.isFinite(Number(coordinate?.altitude)) ? Number(coordinate.altitude) : null,
    heading: Number.isFinite(Number(coordinate?.heading ?? coordinate?.bearing))
      ? Number(coordinate?.heading ?? coordinate?.bearing)
      : null,
    speed: Number.isFinite(Number(coordinate?.speed)) ? Number(coordinate.speed) : null,
    updatedAtMs: Number.isFinite(Number(coordinate?.updatedAtMs ?? coordinate?.time))
      ? Number(coordinate?.updatedAtMs ?? coordinate?.time)
      : Date.now(),
  };
}

function getDestinationFromRequest(request = null) {
  return normalizeCoordinate(
    request?.destination
      || request?.meetingCoordinates
      || request?.studentLocation
      || request?.studentCoordinates
      || request?.coordinates
      || request?.location
      || request?.student?.location
      || null,
  );
}

const STATUS_ORDER = {
  offered: 10,
  pending: 20,
  accepted: 30,
  tutor_accepted: 35,
  travelling: 40,
  en_route: 40,
  arrived: 50,
  waiting_student: 50,
  preparing_for_lesson: 60,
  in_session: 70,
  in_progress: 70,
  ending_requested: 80,
  completed: 90,
  settled: 95,
  canceled: 100,
  canceled_during: 100,
  canceled_by_tutor: 100,
  canceled_by_student: 100,
};

function resolveEffectiveStatus(...candidates) {
  let highestStatus = '';
  let highestRank = -1;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const norm = String(candidate).toLowerCase().trim();
    const rank = STATUS_ORDER[norm] ?? 0;
    if (rank > highestRank) {
      highestRank = rank;
      highestStatus = norm;
    }
  }

  return highestStatus || 'accepted';
}

export function TutorNavigationScreen({
  route,
  navigation,
  onNavigate,
  onBack,
  request: initialRequest = null,
  requestId: propRequestId = '',
  sessionId: propSessionId = '',
}) {
  const { user } = useAuth();
  const navigate = onNavigate || navigation?.navigate;
  const goBack = onBack || navigation?.goBack;

  const routeParams = route?.params || {};
  const requestId = propRequestId || routeParams?.requestId || initialRequest?.id || '';
  const sessionId = propSessionId || routeParams?.sessionId || initialRequest?.sessionId || '';

  const [currentRequest, setCurrentRequest] = useState(initialRequest);
  const [liveTracking, setLiveTracking] = useState(null);
  const [currentTutorLoc, setCurrentTutorLoc] = useState(null);
  const [isStartingTravel, setIsStartingTravel] = useState(false);
  const [isMarkingArrived, setIsMarkingArrived] = useState(false);
  const [isOpeningClass, setIsOpeningClass] = useState(false);
  const [hasMarkedArrived, setHasMarkedArrived] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Subscribe to Firestore request document
  useEffect(() => {
    if (!requestId) return undefined;
    const unsub = subscribeToRequestById(requestId, (req) => {
      if (req) {
        setCurrentRequest((prev) => ({ ...prev, ...req }));
      }
    });
    return () => unsub?.();
  }, [requestId]);

  // Subscribe to RTDB live tracking
  useEffect(() => {
    if (!requestId) return undefined;
    const unsub = subscribeToLiveTracking(requestId, (tracking) => {
      setLiveTracking(tracking);
    });
    return () => unsub?.();
  }, [requestId]);

  // Canonical status resolution
  const currentLiveStatus = useMemo(() => {
    return resolveEffectiveStatus(
      currentRequest?.status,
      liveTracking?.status,
      initialRequest?.status,
      'accepted',
    );
  }, [currentRequest?.status, liveTracking?.status, initialRequest?.status]);

  // Derived state flags
  const isPinVerified = Boolean(
    liveTracking?.meetingPinVerified
    || currentRequest?.meetingPinVerified
    || currentLiveStatus === 'preparing_for_lesson'
    || ['in_session', 'in_progress'].includes(currentLiveStatus)
  );

  const isPreparing = currentLiveStatus === 'preparing_for_lesson' || isPinVerified;
  const isArrived = ['arrived', 'waiting_student', 'preparing_for_lesson', 'in_session', 'in_progress'].includes(currentLiveStatus);
  const isTravelling = ['travelling', 'traveling', 'en_route', 'in_transit'].includes(currentLiveStatus);
  const isAccepted = ['accepted', 'tutor_accepted', 'tutor_assigned'].includes(currentLiveStatus);
  const isInSession = ['in_session', 'in_progress'].includes(currentLiveStatus);
  const canAutoArrive = ['accepted', 'tutor_accepted', 'tutor_assigned', 'travelling', 'traveling', 'en_route', 'in_transit'].includes(currentLiveStatus);

  const effSessionId = sessionId || currentRequest?.sessionId || initialRequest?.sessionId || requestId;

  // Meeting PIN
  const meetingPin = liveTracking?.meetingPin
    || currentRequest?.meetingPin
    || initialRequest?.meetingPin
    || '----';

  // Destination Resolution
  const destination = useMemo(() => {
    return normalizeCoordinate(
      liveTracking?.destination
      || liveTracking?.meetingCoordinates
      || currentRequest?.destination
      || currentRequest?.meetingCoordinates
      || getDestinationFromRequest(currentRequest)
      || getDestinationFromRequest(initialRequest)
      || null,
    );
  }, [
    liveTracking?.destination,
    liveTracking?.meetingCoordinates,
    currentRequest?.destination,
    currentRequest?.meetingCoordinates,
    currentRequest,
    initialRequest,
  ]);

  const studentAddress = useMemo(() => {
    return (
      currentRequest?.meetingAddress
      || liveTracking?.meetingAddress
      || currentRequest?.studentAddress
      || currentRequest?.locationAddress
      || initialRequest?.meetingAddress
      || 'Meeting Location'
    );
  }, [currentRequest, liveTracking, initialRequest]);

  const studentName = currentRequest?.studentName
    || initialRequest?.studentName
    || 'Student';

  const subjectName = currentRequest?.subject
    || currentRequest?.subjectName
    || initialRequest?.subject
    || 'Tutoring Session';

  // Distance to destination
  const distanceToDestMeters = useMemo(() => {
    if (!currentTutorLoc || !destination) return null;
    return getDistanceMeters(
      currentTutorLoc.latitude,
      currentTutorLoc.longitude,
      destination.latitude,
      destination.longitude,
    );
  }, [currentTutorLoc, destination]);

  const isWithin50Meters = distanceToDestMeters !== null && distanceToDestMeters <= 50;

  // Auto-arrival reference to prevent duplicate triggers
  const hasAutoArrivedRef = useRef(false);

  const handleMarkArrived = useCallback(
    async (customDistance = null) => {
      if (!requestId || isMarkingArrived) return;
      setIsMarkingArrived(true);
      setHasMarkedArrived(true);
      hasAutoArrivedRef.current = true;

      const dist = customDistance !== null ? customDistance : (distanceToDestMeters || 0);

      // Optimistic local state updates for instant UI reaction
      setLiveTracking((prev) => (prev ? { ...prev, status: 'arrived', arrivedAtMs: Date.now() } : prev));
      setCurrentRequest((prev) => (prev ? { ...prev, status: 'arrived', arrivedAt: Date.now() } : prev));

      try {
        await markTutorArrived({
          requestId,
          sessionId: effSessionId,
          tutorId: user?.uid,
          distanceMeters: Math.round(dist),
        });
      } catch (err) {
        console.warn('[TutorNavigation] markTutorArrived error:', err);
      } finally {
        setIsMarkingArrived(false);
      }
    },
    [requestId, isMarkingArrived, effSessionId, user?.uid, distanceToDestMeters],
  );

  // Background and Foreground GPS streaming to RTDB
  const lastBroadcastLocRef = useRef(null);
  const streamLocation = useCallback(
    (loc) => {
      if (!loc || !requestId) return;
      setCurrentTutorLoc(loc);

      // Real-time automatic 50m arrival detection on raw location fix
      if (destination && !hasAutoArrivedRef.current && !hasMarkedArrived && !isArrived && canAutoArrive) {
        const streamDist = getDistanceMeters(
          loc.latitude,
          loc.longitude,
          destination.latitude,
          destination.longitude,
        );
        if (streamDist !== null && streamDist <= 50) {
          hasAutoArrivedRef.current = true;
          handleMarkArrived(streamDist);
        }
      }

      const prev = lastBroadcastLocRef.current;
      if (prev) {
        const dist = getDistanceMeters(prev.latitude, prev.longitude, loc.latitude, loc.longitude);
        const headingDiff = Math.abs((prev.heading || 0) - (loc.heading || 0));
        if (dist < 3 && headingDiff < 10 && Date.now() - (prev.time || 0) < 5000) {
          return;
        }
      }

      lastBroadcastLocRef.current = { ...loc, time: Date.now() };

      updateLiveTracking(requestId, {
        tutorLocation: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          heading: loc.heading,
          speed: loc.speed,
          accuracy: loc.accuracy,
          updatedAtMs: Date.now(),
        },
        updatedAtMs: Date.now(),
      }).catch(() => null);

      if (user?.uid) {
        saveUserLiveLocation(user.uid, loc).catch(() => null);
      }
    },
    [requestId, user?.uid, destination, hasMarkedArrived, isArrived, canAutoArrive, handleMarkArrived],
  );

  useEffect(() => {
    if (!requestId) return undefined;
    let isActive = true;
    let locationWatchSub = null;

    async function initTracking() {
      const initial = await getBestAvailableLocation(user).catch(() => null);
      if (initial && isActive) {
        streamLocation(initial);
      }

      try {
        const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (perm?.status === 'granted' || String(perm?.status || '').toLowerCase() === 'granted') {
          locationWatchSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 3,
              timeInterval: 3000,
            },
            (pos) => {
              if (pos?.coords && isActive) {
                const norm = normalizeLocation(pos.coords, 'device');
                if (norm) {
                  streamLocation(norm);
                }
              }
            },
          );
        }
      } catch (watchErr) {
        console.warn('[TutorNavigation] watchPositionAsync error:', watchErr?.message);
      }
    }

    initTracking();
    const interval = setInterval(async () => {
      const loc = await getCurrentLocationSnapshot().catch(() => null);
      if (loc && isActive) {
        streamLocation(loc);
      }
    }, 3000);

    return () => {
      isActive = false;
      clearInterval(interval);
      if (locationWatchSub) {
        locationWatchSub.remove();
      }
    };
  }, [requestId, user, streamLocation]);

  // Periodically refresh route metrics via Routes API
  const lastFetchedRouteOriginRef = useRef(null);
  useEffect(() => {
    if (!requestId || !destination || !currentTutorLoc) return;

    if (lastFetchedRouteOriginRef.current) {
      const movedMeters = getDistanceMeters(
        lastFetchedRouteOriginRef.current.latitude,
        lastFetchedRouteOriginRef.current.longitude,
        currentTutorLoc.latitude,
        currentTutorLoc.longitude,
      );
      if (movedMeters < 150) return;
    }

    lastFetchedRouteOriginRef.current = currentTutorLoc;
    fetchLiveRoute({
      requestId,
      origin: currentTutorLoc,
      destination,
    }).catch(() => null);
  }, [requestId, destination, currentTutorLoc]);

  // Grace Period Countdowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const arrivalGraceExpiresAtMs = useMemo(() => {
    return (
      liveTracking?.arrivalGraceExpiresAtMs
      || currentRequest?.arrivalGraceExpiresAtMs
      || (liveTracking?.arrivedAtMs ? liveTracking.arrivedAtMs + 5 * 60 * 1000 : null)
      || null
    );
  }, [liveTracking, currentRequest]);

  const prepGraceExpiresAtMs = useMemo(() => {
    return (
      liveTracking?.prepGraceExpiresAtMs
      || currentRequest?.prepGraceExpiresAtMs
      || (liveTracking?.prepGraceStartedAtMs ? liveTracking.prepGraceStartedAtMs + 5 * 60 * 1000 : null)
      || null
    );
  }, [liveTracking, currentRequest]);

  const remainingArrivalGraceMs = arrivalGraceExpiresAtMs ? Math.max(0, arrivalGraceExpiresAtMs - now) : null;
  const remainingPrepGraceMs = prepGraceExpiresAtMs ? Math.max(0, prepGraceExpiresAtMs - now) : null;

  // Auto-navigate to Active Session if session becomes active
  useEffect(() => {
    if (isInSession) {
      navigate?.('TutorActiveSession', {
        sessionId: effSessionId,
        requestId,
        request: currentRequest || initialRequest,
      });
    }
  }, [isInSession, effSessionId, requestId, currentRequest, initialRequest, navigate]);

  // Action Handlers
  async function handleStartTravel() {
    if (!requestId || isStartingTravel) return;
    setIsStartingTravel(true);
    try {
      await startTutorTravel({ requestId, tutorId: user?.uid });
    } catch (err) {
      console.warn('handleStartTravel error:', err);
    } finally {
      setIsStartingTravel(false);
    }
  }

  // Auto-arrival detection when within 50 meters
  useEffect(() => {
    if (isWithin50Meters && canAutoArrive && !hasMarkedArrived && !isArrived && !hasAutoArrivedRef.current) {
      hasAutoArrivedRef.current = true;
      handleMarkArrived();
    }
  }, [isWithin50Meters, canAutoArrive, hasMarkedArrived, isArrived, handleMarkArrived]);

  async function handleStartLesson() {
    if (isOpeningClass) return;
    if (isArrived && !isPreparing && !isPinVerified) {
      Alert.alert('PIN Required', 'The student must enter the 4-digit PIN before the lesson can be started.');
      return;
    }

    setIsOpeningClass(true);
    try {
      await startInPersonLesson({
        requestId,
        sessionId: effSessionId,
        tutorId: user?.uid,
      });
      navigate?.('TutorActiveSession', {
        sessionId: effSessionId,
        requestId,
        request: currentRequest || initialRequest,
      });
    } catch (err) {
      Alert.alert('Unable to Start Lesson', err.message || 'An error occurred starting the lesson.');
    } finally {
      setIsOpeningClass(false);
    }
  }

  function handleOpenMaps() {
    if (!destination?.latitude || !destination?.longitude) {
      Alert.alert('No Destination', 'Destination coordinates are not available.');
      return;
    }
    openExternalNavigation({
      latitude: destination.latitude,
      longitude: destination.longitude,
      destinationName: studentAddress,
    });
  }

  function handleOpenWaze() {
    if (!destination?.latitude || !destination?.longitude) return;
    openWazeNavigation({
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
  }

  function handleCallStudent() {
    const phone = currentRequest?.studentPhone || currentRequest?.student?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call.');
      });
    } else {
      Alert.alert('Contact Student', 'Phone number not provided on this request.');
    }
  }

  function handleMessageStudent() {
    const phone = currentRequest?.studentPhone || currentRequest?.student?.phone;
    if (phone) {
      Linking.openURL(`sms:${phone}`).catch(() => {
        Alert.alert('Error', 'Unable to open messaging application.');
      });
    } else {
      Alert.alert('Contact Student', 'Contact information not provided on this request.');
    }
  }

  // Visual status UI mappings matching student app tone
  const statusUi = useMemo(() => {
    if (isInSession) {
      return {
        badge: 'IN SESSION',
        title: 'Lesson in progress',
        subtitle: 'The billing clock and lesson session timer are running.',
        tone: '#059669',
        icon: 'time',
      };
    }
    if (isPreparing) {
      return {
        badge: 'PREPARATION GRACE',
        title: 'PIN Verified — Preparing Lesson',
        subtitle: '5-minute grace window active. Prepare study materials before starting.',
        tone: '#7c3aed',
        icon: 'book',
      };
    }
    if (isArrived) {
      return {
        badge: 'ARRIVED AT LOCATION',
        title: 'Waiting for Student Meeting PIN',
        subtitle: 'Share your 4-digit code with the student to verify meeting.',
        tone: '#2563eb',
        icon: 'checkmark-circle',
      };
    }
    if (isTravelling) {
      return {
        badge: 'EN ROUTE',
        title: 'Travelling to Meeting Location',
        subtitle: 'Navigate with Google Maps or Waze below. Background GPS streams to student.',
        tone: '#059669',
        icon: 'car-sport',
      };
    }
    return {
      badge: 'TRIP ACCEPTED',
      title: 'Ready to Depart',
      subtitle: 'Tap "Start Travel" when you are on your way to the student.',
      tone: '#059669',
      icon: 'navigate',
    };
  }, [isInSession, isPreparing, isArrived, isTravelling]);

  return (
    <View style={styles.screen}>
      {/* 1. Middle Visual Section (Race Track Progress Bar where map used to be) */}
      <View style={styles.middleTrackContainer} pointerEvents="box-none">
        <TravelRaceTrack
          currentStatus={currentLiveStatus}
          tutorLocation={currentTutorLoc}
          destinationAddress={studentAddress}
          tutorName="You"
          liveTracking={liveTracking}
        />
      </View>

      {/* 2. Floating Top Header Card (Identical to Student Session Screen) */}
      <View style={styles.topBarWrap} pointerEvents="box-none">
        <View style={styles.topCard} pointerEvents="auto">
          {/* Back Button on the Left */}
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => (goBack ? goBack() : navigate?.('Dashboard'))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.topIconButton}
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>

          {/* Highlighted Subject Pill in the Center */}
          <View style={styles.topSubjectWrap}>
            <View style={styles.topSubjectPill}>
              <View style={styles.topSubjectDot} />
              <Text style={styles.topSubjectText} numberOfLines={1}>
                {subjectName}
              </Text>
            </View>
          </View>

          {/* Safety Button on the Right */}
          <Pressable
            accessibilityLabel="Safety Center"
            accessibilityRole="button"
            onPress={() => setShowSafetyModal(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.topIconButton}
          >
            <Ionicons name="shield-checkmark" size={20} color="#059669" />
          </Pressable>
        </View>
      </View>

      {/* 3. Bottom Sheet Section (Identical to Student Session Screen) */}
      <View style={styles.bottomCard} pointerEvents="auto">
        <ScrollView
          style={styles.bottomScroll}
          contentContainerStyle={styles.bottomScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Header Block */}
          <View style={styles.liveStatusHeader}>
            <View style={[styles.liveStatusIcon, { backgroundColor: `${statusUi.tone}18` }]}>
              <Ionicons name={statusUi.icon} size={22} color={statusUi.tone} />
            </View>
            <View style={styles.liveStatusTextWrap}>
              <Text style={[styles.liveStatusBadge, { color: statusUi.tone }]}>{statusUi.badge}</Text>
              <Text style={styles.liveStatusTitle}>{statusUi.title}</Text>
              <Text style={styles.liveStatusSubtitle}>{statusUi.subtitle}</Text>
            </View>
          </View>

          {/* Turn-by-Turn Navigation Card (Google Maps / Waze) when travelling */}
          {!isArrived && (
            <View style={styles.mapsCard}>
              <View style={styles.mapsActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleOpenMaps}
                  style={styles.openGoogleMapsButton}
                >
                  <Ionicons name="map" size={17} color="#ffffff" />
                  <Text style={styles.openGoogleMapsText}>Google Maps</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleOpenWaze}
                  style={styles.openWazeButton}
                >
                  <Ionicons name="car" size={17} color="#0284c7" />
                  <Text style={styles.openWazeText}>Waze</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Arrival Grace Countdown Banner */}
          {isArrived && !isPinVerified && remainingArrivalGraceMs !== null && (
            <View style={styles.graceBanner}>
              <Ionicons name="timer-outline" size={18} color="#2563eb" />
              <Text style={styles.graceText}>
                Arrival Grace:{' '}
                <Text style={styles.graceCountdown}>
                  {formatGraceCountdown(remainingArrivalGraceMs)}
                </Text>{' '}
                (Billing not started)
              </Text>
            </View>
          )}

          {/* Preparation Grace Countdown Banner */}
          {isPreparing && !isInSession && remainingPrepGraceMs !== null && (
            <View style={[styles.graceBanner, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
              <Ionicons name="book-outline" size={18} color="#7c3aed" />
              <Text style={[styles.graceText, { color: '#6d28d9' }]}>
                Preparation Grace:{' '}
                <Text style={[styles.graceCountdown, { color: '#6d28d9' }]}>
                  {formatGraceCountdown(remainingPrepGraceMs)}
                </Text>{' '}
                (Billing held)
              </Text>
            </View>
          )}

          {/* Meeting Verification PIN Card (Tutor View) */}
          {isArrived && !isPinVerified && (
            <View style={styles.pinCard}>
              <Text style={styles.pinEyebrow}>MEETING VERIFICATION PIN</Text>
              <Text style={styles.pinValue}>{meetingPin}</Text>
              <Text style={styles.pinInstructions}>
                Ask student to enter this 4-digit code on their screen to verify meeting and unlock lesson start.
              </Text>
            </View>
          )}

          {/* Primary Lifecycle Action Buttons */}
          {isAccepted && !isTravelling && !isArrived && (
            <Pressable
              accessibilityRole="button"
              onPress={handleStartTravel}
              disabled={isStartingTravel}
              style={styles.primaryActionButton}
            >
              {isStartingTravel ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="navigate" size={20} color="#ffffff" />
                  <Text style={styles.primaryActionText}>Start Travel to Student</Text>
                </>
              )}
            </Pressable>
          )}

          {isTravelling && !isArrived && (
            <Pressable
              accessibilityRole="button"
              onPress={handleMarkArrived}
              disabled={isMarkingArrived}
              style={styles.primaryActionButton}
            >
              {isMarkingArrived ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.primaryActionText}>I Have Arrived</Text>
                </>
              )}
            </Pressable>
          )}

          {isPreparing && !isInSession && (
            <Pressable
              accessibilityRole="button"
              onPress={handleStartLesson}
              disabled={isOpeningClass}
              style={styles.primaryActionButton}
            >
              {isOpeningClass ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="play" size={20} color="#ffffff" />
                  <Text style={styles.primaryActionText}>Start Lesson Now</Text>
                </>
              )}
            </Pressable>
          )}

          {isInSession && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                navigate?.('TutorActiveSession', {
                  sessionId: effSessionId,
                  requestId,
                  request: currentRequest || initialRequest,
                });
              }}
              style={styles.primaryActionButton}
            >
              <Ionicons name="time" size={20} color="#ffffff" />
              <Text style={styles.primaryActionText}>Open Active Session Room</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          )}

          {/* Student Info & Address Row */}
          <View style={styles.studentInfoStrip}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>
                {String(studentName || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentNameText}>{studentName}</Text>
              <Text style={styles.studentAddressText} numberOfLines={1}>
                {studentAddress}
              </Text>
            </View>
          </View>

          {/* Quick Action Pills Row (Call, Message, Cancel) */}
          <View style={styles.pillActionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={handleCallStudent}
              style={styles.pillActionButton}
            >
              <Ionicons name="call" size={16} color="#0f172a" />
              <Text style={styles.pillActionText}>Call</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleMessageStudent}
              style={styles.pillActionButton}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#0f172a" />
              <Text style={styles.pillActionText}>Message</Text>
            </Pressable>

            {!isInSession && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowCancelModal(true)}
                style={styles.cancelPillButton}
              >
                <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                <Text style={styles.cancelPillText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Safety Support Modal */}
      <SafetySupportModal
        visible={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        requestId={requestId}
        session={currentRequest}
        userRole="tutor"
      />

      {/* Cancellation Modal */}
      <CancellationQuoteModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        requestId={requestId}
        session={currentRequest}
        userRole="tutor"
        onConfirmCancel={async (reason) => {
          setShowCancelModal(false);
          await cancelInPersonSession({
            requestId,
            sessionId: effSessionId,
            tutorId: user?.uid,
            reason: reason || 'Tutor canceled travel',
            canceledBy: 'tutor',
          });
          goBack ? goBack() : navigate?.('Dashboard');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ecfdf5',
    flex: 1,
  },
  middleTrackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 108,
    paddingBottom: 16,
    position: 'relative',
  },
  topBarWrap: {
    elevation: 210,
    left: 16,
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'android' ? 44 : 54,
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
    backgroundColor: '#059669',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  topSubjectText: {
    color: '#064e3b',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 200,
    maxHeight: '62%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    zIndex: 200,
  },
  bottomScroll: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bottomScrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  liveStatusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  liveStatusTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  liveStatusSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  mapsCard: {
    marginBottom: 12,
  },
  mapsActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  openGoogleMapsButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  openGoogleMapsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  openWazeButton: {
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  openWazeText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '800',
  },
  graceBanner: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  graceText: {
    color: '#1d4ed8',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  graceCountdown: {
    fontWeight: '900',
  },
  pinCard: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
  },
  pinEyebrow: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pinValue: {
    color: '#10b981',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 8,
    marginVertical: 6,
  },
  pinInstructions: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  studentInfoStrip: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    padding: 10,
  },
  studentAvatar: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 18,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  studentAvatarText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '900',
  },
  studentDetails: {
    flex: 1,
  },
  studentNameText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  studentAddressText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  pillActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillActionButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  pillActionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelPillButton: {
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelPillText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
});
