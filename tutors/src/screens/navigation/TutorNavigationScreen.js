import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleMapColorScheme,
  GoogleNavigationSessionStatus,
  GoogleNavigationView,
  GoogleRouteStatus,
  GoogleTravelMode,
  googleNavigationSdkAvailable,
  useGoogleNavigationSafe,
} from '../../services/googleNavigationSdk';
import * as Location from 'expo-location';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getFirebaseClients } from '../../firebase/config';
import { subscribeToRequestById } from '../../services/classRequestService';
import { subscribeToLiveTracking, updateLiveTracking } from '../../services/liveTrackingRealtimeService';
import { getBestAvailableLocation, getCurrentLocationSnapshot, normalizeLocation, saveUserLiveLocation } from '../../services/locationService';
import {
  cancelInPersonSession,
  markPreparingForLesson,
  markTutorArrived,
  startInPersonLesson,
  startInPersonSession,
  startTutorTravel,
} from '../../services/sessionService';
import { SafetySupportModal } from '../../components/common/SafetySupportModal';
import { CancellationQuoteModal } from '../../components/common/CancellationQuoteModal';
import { extractSafetySnapshot } from '../../constants/safety';
import { useAuth } from '../../context/AuthContext';

const ANDROID_NAVIGATION_SDK = Platform.OS === 'android' && googleNavigationSdkAvailable && Boolean(GoogleNavigationView);

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
      || request?.studentLocation
      || request?.meetingCoordinates
      || request?.studentCoordinates
      || request?.coordinates
      || request?.location
      || request?.student?.location
      || null,
  );
}

function formatEta(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Calculating';
  return `${Math.max(1, Math.ceil(numeric / 60))} min`;
}

function formatDistance(meters) {
  const numeric = Number(meters);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Route pending';
  if (numeric < 1000) return `${Math.round(numeric)} m`;
  return `${(numeric / 1000).toFixed(1)} km`;
}

function getStatusCopy(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'accepted') {
    return {
      badge: 'Accepted',
      title: 'Ready to head out',
      subtitle: 'Tap "Start Travelling" when you depart to the student.',
      icon: 'car-sport-outline',
      tone: '#059669',
    };
  }

  if (['travelling', 'traveling', 'in_transit'].includes(normalized)) {
    return {
      badge: 'En route',
      title: 'Drive to the student',
      subtitle: 'Guiding you to the student meeting location.',
      icon: 'navigate-circle',
      tone: '#0f766e',
    };
  }

  if (['arrived', 'waiting_student'].includes(normalized)) {
    return {
      badge: 'Arrived',
      title: 'You are at the student',
      subtitle: '5-minute arrival grace active. Locate the student and get ready.',
      icon: 'checkmark-circle',
      tone: '#059669',
    };
  }

  if (normalized === 'preparing_for_lesson') {
    return {
      badge: 'Preparing',
      title: 'Preparing for lesson',
      subtitle: 'Set up books and study workspace. Start lesson when ready.',
      icon: 'book-outline',
      tone: '#7c3aed',
    };
  }

  if (['in_session', 'in_progress', 'active'].includes(normalized)) {
    return {
      badge: 'In Session',
      title: 'Lesson active',
      subtitle: 'Live lesson is underway.',
      icon: 'play-circle',
      tone: '#059669',
    };
  }

  if (['canceled', 'cancelled', 'expired', 'closed'].includes(normalized)) {
    return {
      badge: 'Closed',
      title: 'This request is no longer active',
      subtitle: 'Navigation has stopped because the request was closed.',
      icon: 'alert-circle',
      tone: '#e11d48',
    };
  }

  return {
    badge: 'En route',
    title: 'Drive to the student',
    subtitle: 'Guiding you to the live student destination.',
    icon: 'navigate-circle',
    tone: '#0f766e',
  };
}

function openExternalNavigation(destination, address) {
  if (!destination && !address) return;
  const lat = destination?.latitude;
  const lng = destination?.longitude;
  const query = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(address || '');
  const url = Platform.select({
    ios: `maps://app?daddr=${query}&dirflg=d`,
    android: `google.navigation:q=${query}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  });

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
      }
    })
    .catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
    });
}

function TutorNavigationScreenInner({ route, navigate, goBack }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const requestId = String(params.requestId || '').trim();
  const sessionId = String(params.sessionId || '').trim();
  const initialRequest = params.request || null;
  const [liveTracking, setLiveTracking] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasSdkLocation, setHasSdkLocation] = useState(false);
  const [routeStatus, setRouteStatus] = useState('');
  const [error, setError] = useState('');
  const [useFallback, setUseFallback] = useState(false);
  const [isStartingTravel, setIsStartingTravel] = useState(false);
  const [isMarkingArrived, setIsMarkingArrived] = useState(false);
  const [isMarkingPreparing, setIsMarkingPreparing] = useState(false);
  const hasStartedRouteRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastLocationWriteRef = useRef(0);
  const destinationKeyRef = useRef('');
  const isClosedRef = useRef(false);
  const terminalStatusRef = useRef('');
  const handleMarkArrivedRef = useRef(null);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    navigationController,
    setOnArrival,
    setOnLocationChanged,
    setOnRemainingTimeOrDistanceChanged,
    removeAllListeners,
  } = useGoogleNavigationSafe();

  const destination = useMemo(() => {
    return normalizeCoordinate(liveTracking?.destination)
      || normalizeCoordinate(liveTracking?.studentLocation)
      || normalizeCoordinate(liveTracking?.meetingCoordinates)
      || getDestinationFromRequest(initialRequest);
  }, [initialRequest, liveTracking?.destination, liveTracking?.meetingCoordinates, liveTracking?.studentLocation]);

  const currentLiveStatus = String(liveTracking?.status || initialRequest?.status || 'accepted').toLowerCase();
  const isAccepted = currentLiveStatus === 'accepted';
  const isTravelling = ['travelling', 'traveling', 'in_transit'].includes(currentLiveStatus);
  const isArrived = ['waiting_student', 'arrived'].includes(currentLiveStatus);
  const isPreparing = currentLiveStatus === 'preparing_for_lesson';

  const safety = useMemo(() => {
    return extractSafetySnapshot(initialRequest || liveTracking);
  }, [initialRequest, liveTracking]);

  const arrivalGraceEndsAt = Number(
    liveTracking?.arrivalGraceEndsAt
    || liveTracking?.arrivalGraceEndsAtMs
    || initialRequest?.arrivalGraceEndsAt
    || 0
  );
  const remainingArrivalGraceMs = arrivalGraceEndsAt ? Math.max(0, arrivalGraceEndsAt - now) : 0;

  const prepGraceEndsAt = Number(
    liveTracking?.preparationGraceEndsAt
    || initialRequest?.preparationGraceEndsAt
    || 0
  );
  const remainingPrepGraceMs = prepGraceEndsAt ? Math.max(0, prepGraceEndsAt - now) : 0;

  const verificationPin = String(
    liveTracking?.verificationPin
    || initialRequest?.verificationPin
    || ''
  ).trim();

  const studentName = liveTracking?.studentName || initialRequest?.studentName || 'Student';
  const studentAddress = initialRequest?.studentAddress || initialRequest?.locationAddress || 'Student location';
  const subject = initialRequest?.subject || 'Class';
  const statusCopy = getStatusCopy(currentLiveStatus);
  const distanceText = formatDistance(liveTracking?.distanceRemainingMeters || liveTracking?.distanceMeters);
  const etaText = formatEta(liveTracking?.etaSeconds || liveTracking?.durationSeconds);

  useEffect(() => {
    terminalStatusRef.current = currentLiveStatus;
  }, [currentLiveStatus]);

  useEffect(() => {
    if (!requestId) {
      setLiveTracking(null);
      return () => {};
    }

    return subscribeToLiveTracking(
      requestId,
      setLiveTracking,
      () => setError('Unable to read live tracking for this request.'),
    );
  }, [requestId]);

  useEffect(() => {
    setOnLocationChanged((location) => {
      const tutorLocation = normalizeCoordinate(location);
      if (!tutorLocation || !requestId) return;

      setHasSdkLocation(true);
      if (['waiting_student', 'canceled', 'cancelled', 'expired', 'closed'].includes(terminalStatusRef.current)) {
        return;
      }

      const now = Date.now();
      if (now - lastLocationWriteRef.current < 3000) return;

      lastLocationWriteRef.current = now;
      updateLiveTracking(requestId, {
        tutorId: user?.uid || '',
        tutorLocation,
        status: currentLiveStatus,
        updatedAtMs: now,
      }).catch(() => null);
      saveUserLiveLocation(user?.uid || '', tutorLocation).catch(() => null);
    });

    setOnRemainingTimeOrDistanceChanged((timeAndDistance) => {
      if (!requestId) return;
      updateLiveTracking(requestId, {
        distanceRemainingMeters: timeAndDistance?.meters,
        etaSeconds: timeAndDistance?.seconds,
        updatedAtMs: Date.now(),
      }).catch(() => null);

      if (
        Number.isFinite(Number(timeAndDistance?.meters)) &&
        Number(timeAndDistance.meters) <= 50 &&
        ['travelling', 'traveling', 'in_transit'].includes(terminalStatusRef.current)
      ) {
        handleMarkArrivedRef.current?.();
      }
    });

    setOnArrival((event) => {
      if (!requestId || event?.isFinalDestination === false) return;
      isClosedRef.current = true;
      handleMarkArrivedRef.current?.();
    });

    return () => {
      removeAllListeners();
    };
  }, [
    navigationController,
    removeAllListeners,
    requestId,
    setOnArrival,
    setOnLocationChanged,
    setOnRemainingTimeOrDistanceChanged,
    user?.uid,
  ]);

  useEffect(() => {
    let isCurrent = true;

    async function primeLocation() {
      if (!requestId || !user?.uid) return;
      const tutorLocation = await getCurrentLocationSnapshot().catch(() => null);
      if (!isCurrent || !tutorLocation) return;

      await updateLiveTracking(requestId, {
        tutorId: user.uid,
        tutorLocation,
        status: currentLiveStatus,
        updatedAtMs: Date.now(),
      }).catch(() => null);
      await saveUserLiveLocation(user.uid, tutorLocation).catch(() => null);
    }

    primeLocation();

    return () => {
      isCurrent = false;
    };
  }, [currentLiveStatus, requestId, user?.uid]);

  const startNavigation = useCallback(async () => {
    if (!destination || !requestId || isInitializing) return;

    const nextDestinationKey = `${destination.latitude.toFixed(6)},${destination.longitude.toFixed(6)}`;
    if (hasStartedRouteRef.current && destinationKeyRef.current === nextDestinationKey) return;

    try {
      setIsInitializing(true);
      setError('');

      const permResult = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (permResult?.status !== 'granted') {
        setError('Location permission is required for in-app navigation.');
        return;
      }

      if (!hasInitializedRef.current) {
        const accepted = await navigationController.showTermsAndConditionsDialog().catch(() => true);
        if (!accepted) {
          setError('Navigation terms must be accepted before turn-by-turn guidance can start.');
          return;
        }

        const initStatus = await navigationController.init().catch((e) => e?.message || 'Error');
        if (initStatus !== GoogleNavigationSessionStatus.OK && initStatus !== 'OK') {
          console.warn('[TutorNavigationScreenInner] Navigation init status:', initStatus);
          setError(`Google Navigation could not start: ${initStatus}`);
          setUseFallback(true);
          return;
        }

        navigationController.startUpdatingLocation();
        hasInitializedRef.current = true;
      }

      if (!hasSdkLocation) {
        setRouteStatus('Waiting for GPS');
      }

      const waypoint = {
        title: studentAddress || `${studentName} location`,
        position: {
          lat: destination.latitude,
          lng: destination.longitude,
        },
      };

      const nextRouteStatus = await navigationController.setDestinations([waypoint], {
        routingOptions: {
          travelMode: GoogleTravelMode.DRIVING,
          avoidFerries: false,
          avoidTolls: false,
        },
        displayOptions: {
          showDestinationMarkers: true,
        },
      }).catch((err) => err?.message || 'ROUTE_ERROR');

      setRouteStatus(String(nextRouteStatus));
      if (nextRouteStatus !== GoogleRouteStatus.OK && nextRouteStatus !== 'OK') {
        setError(`Route calculation issue: ${nextRouteStatus}. You can use Google Maps button below.`);
        return;
      }

      await navigationController.startGuidance().catch(() => null);
      destinationKeyRef.current = nextDestinationKey;
      hasStartedRouteRef.current = true;

      await updateLiveTracking(requestId, {
        tutorId: user?.uid || '',
        destination,
        status: currentLiveStatus,
        updatedAtMs: Date.now(),
      }).catch(() => null);
    } catch (err) {
      console.warn('[TutorNavigationScreenInner] Google Navigation exception:', err?.message);
      setError(err?.message || 'Google Navigation could not start.');
      setUseFallback(true);
    } finally {
      setIsInitializing(false);
    }
  }, [
    currentLiveStatus,
    destination,
    hasSdkLocation,
    isInitializing,
    navigationController,
    requestId,
    studentAddress,
    studentName,
    user?.uid,
  ]);

  useEffect(() => {
    if (isMapReady && !hasStartedRouteRef.current) {
      startNavigation();
    }
  }, [isMapReady, startNavigation]);

  useEffect(() => {
    return () => {
      if (isClosedRef.current) return;
      navigationController.stopGuidance().catch(() => null);
      navigationController.stopUpdatingLocation();
    };
  }, [navigationController]);

  async function handleStartTravel() {
    if (!requestId || isStartingTravel) return;
    setIsStartingTravel(true);
    try {
      await startTutorTravel({ requestId, tutorId: user?.uid });
      if (hasStartedRouteRef.current) {
        await navigationController.startGuidance().catch(() => null);
      }
    } catch (err) {
      console.warn('[TutorNavigationScreenInner] handleStartTravel error:', err);
    } finally {
      setIsStartingTravel(false);
    }
  }

  async function handleMarkArrived() {
    if (!requestId || isMarkingArrived) return;
    setIsMarkingArrived(true);
    try {
      await markTutorArrived({
        requestId,
        sessionId: sessionId || requestId,
        tutorId: user?.uid,
        distanceMeters: 0,
      });
      await navigationController.stopGuidance().catch(() => null);
    } catch (err) {
      console.warn('[TutorNavigationScreenInner] handleMarkArrived error:', err);
    } finally {
      setIsMarkingArrived(false);
    }
  }
  handleMarkArrivedRef.current = handleMarkArrived;

  async function handleMarkPreparing() {
    if (!requestId || isMarkingPreparing) return;
    setIsMarkingPreparing(true);
    try {
      await markPreparingForLesson({
        requestId,
        sessionId: sessionId || requestId,
        tutorId: user?.uid,
      });
    } catch (err) {
      console.warn('[TutorNavigationScreenInner] handleMarkPreparing error:', err);
    } finally {
      setIsMarkingPreparing(false);
    }
  }

  async function handleOpenClass() {
    const effectiveSessionId = sessionId || requestId;
    try {
      await startInPersonSession({
        sessionId: effectiveSessionId,
        requestId,
        tutorId: user?.uid,
        studentId: initialRequest?.studentId,
        pricingSnapshot: initialRequest?.pricingSnapshot,
        subject: initialRequest?.subject || 'Mathematics',
        topic: initialRequest?.topic,
      }).catch((err) => console.warn('startInPersonSession error:', err));
    } catch (_err) {}

    navigate?.('TutorActiveSession', {
      sessionId: effectiveSessionId,
      requestId,
      request: initialRequest,
    });
  }

  if (useFallback) {
    return (
      <TutorNavigationFallbackScreen
        route={route}
        navigate={navigate}
        goBack={goBack}
        errorMessage={error}
        onRetry={() => {
          setUseFallback(false);
          hasInitializedRef.current = false;
          hasStartedRouteRef.current = false;
          startNavigation();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <GoogleNavigationView
        style={styles.map}
        mapColorScheme={GoogleMapColorScheme.LIGHT}
        myLocationEnabled
        myLocationButtonEnabled
        recenterButtonEnabled
        trafficEnabled
        headerEnabled
        footerEnabled
        tripProgressBarEnabled
        speedometerEnabled
        onMapReady={() => setIsMapReady(true)}
        androidStylingOptions={{
          primaryDayModeThemeColor: '#059669',
          secondaryDayModeThemeColor: '#0f766e',
          headerDistanceValueTextColor: '#ffffff',
          headerDistanceUnitsTextColor: '#dcfce7',
          headerInstructionsTextColor: '#ffffff',
          headerNextStepTextColor: '#dcfce7',
        }}
        mapPadding={{
          top: 96,
          left: 0,
          right: 0,
          bottom: 230,
        }}
      />

      <View style={styles.topBarWrap}>
        <View style={styles.topCard}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={goBack}
            style={styles.topIconButton}
          >
            <Ionicons name="chevron-back" size={26} color="#0f172a" />
          </Pressable>

          <View style={styles.topSubjectWrap}>
            <View style={styles.topSubjectPill}>
              <View style={styles.topSubjectDot} />
              <Text style={styles.topSubjectText} numberOfLines={1}>
                {subject}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="Recenter navigation"
            accessibilityRole="button"
            onPress={startNavigation}
            style={styles.topIconButton}
          >
            <Ionicons name="navigate" size={22} color="#059669" />
          </Pressable>
        </View>
      </View>

      <View style={styles.bottomCard}>
        <View style={styles.liveStatusHeader}>
          <View style={[styles.liveStatusIcon, { backgroundColor: `${statusCopy.tone}18` }]}>
            <Ionicons name={statusCopy.icon} size={24} color={statusCopy.tone} />
          </View>
          <View style={styles.liveStatusTextWrap}>
            <Text style={styles.liveStatusBadge}>{statusCopy.badge}</Text>
            <Text style={styles.liveStatusTitle}>{statusCopy.title}</Text>
            <Text style={styles.liveStatusSubtitle}>{statusCopy.subtitle}</Text>
          </View>
        </View>

        {/* Guardian Presence Safety Notice (REQ-011) */}
        {(safety.isMinor || safety.guardianPresenceRequired) ? (
          <View style={styles.guardianSafetyBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#d97706" />
            <View style={styles.guardianSafetyTextWrap}>
              <Text style={styles.guardianSafetyTitle}>
                {safety.isMinor ? 'Minor Learner (Guardian Required)' : 'Guardian Presence Required'}
              </Text>
              <Text style={styles.guardianSafetySub}>
                Parent/Guardian {safety.guardianName ? `(${safety.guardianName}) ` : ''}must be present during the in-person session.
              </Text>
            </View>
          </View>
        ) : null}

        {/* 5-Minute Arrival Grace Period Banner (Milestone M4) */}
        {isArrived && !isPreparing ? (
          <View style={styles.graceTimerBanner}>
            <Ionicons name="timer-outline" size={18} color="#059669" />
            <Text style={styles.graceTimerText}>
              Arrival Grace:{' '}
              <Text style={styles.graceCountdown}>
                {formatGraceCountdown(remainingArrivalGraceMs)}
              </Text>{' '}
              (No billing)
            </Text>
          </View>
        ) : null}

        {/* 5-Minute Preparation Grace Period Banner (Milestone M4) */}
        {isPreparing ? (
          <View style={[styles.graceTimerBanner, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
            <Ionicons name="book-outline" size={18} color="#7c3aed" />
            <Text style={[styles.graceTimerText, { color: '#6d28d9' }]}>
              Preparation Grace:{' '}
              <Text style={[styles.graceCountdown, { color: '#6d28d9' }]}>
                {formatGraceCountdown(remainingPrepGraceMs)}
              </Text>
            </Text>
          </View>
        ) : null}

        {/* Physical Meeting 4-Digit PIN Card (Milestone M4) */}
        {(isArrived || isPreparing) ? (
          <View style={styles.pinCard}>
            <View style={styles.pinHeader}>
              <Ionicons name="keypad" size={18} color="#059669" />
              <Text style={styles.pinHeaderTitle}>PHYSICAL MEETING PIN</Text>
            </View>
            <Text style={styles.pinCode}>{verificationPin || '----'}</Text>
            <Text style={styles.pinSubtitle}>
              Show this 4-digit code to the student to verify arrival
            </Text>
          </View>
        ) : null}

        <View style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>{String(studentName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentLabel}>Student</Text>
            <Text style={styles.studentName}>{studentName}</Text>
            <Text style={styles.studentAddress} numberOfLines={1}>{studentAddress}</Text>
          </View>
          <View style={styles.routeEstimateBox}>
            <Text style={styles.routeEstimateValue}>{etaText}</Text>
            <Text style={styles.routeEstimateLabel}>{distanceText}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color="#e11d48" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!destination ? (
          <View style={styles.errorCard}>
            <Ionicons name="location-outline" size={16} color="#d97706" />
            <Text style={[styles.errorText, styles.warningText]}>
              Waiting for the student destination from live tracking.
            </Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          {/* External Google Maps Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => openExternalNavigation(destination, studentAddress)}
            style={styles.externalMapsButton}
          >
            <Ionicons name="map-outline" size={16} color="#047857" />
            <Text style={styles.externalMapsButtonText}>Google Maps</Text>
          </Pressable>

          {isAccepted ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleStartTravel}
              disabled={isStartingTravel}
              style={styles.startTravelButton}
            >
              {isStartingTravel ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="car-sport" size={18} color="#ffffff" />
                  <Text style={styles.startTravelButtonText}>Start Travelling</Text>
                </>
              )}
            </Pressable>
          ) : isTravelling ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleMarkArrived}
              disabled={isMarkingArrived}
              style={styles.arrivedButton}
            >
              {isMarkingArrived ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="location" size={18} color="#ffffff" />
                  <Text style={styles.arrivedButtonText}>I Have Arrived</Text>
                </>
              )}
            </Pressable>
          ) : isArrived && !isPreparing ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleMarkPreparing}
                disabled={isMarkingPreparing}
                style={styles.preparingButton}
              >
                {isMarkingPreparing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="book" size={16} color="#ffffff" />
                    <Text style={styles.preparingButtonText}>Preparing</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleOpenClass}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Start Lesson</Text>
                <Ionicons name="play" size={16} color="#ffffff" />
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenClass}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Start Lesson & Timer</Text>
              <Ionicons name="play" size={18} color="#ffffff" />
            </Pressable>
          )}
        </View>

        {routeStatus ? <Text style={styles.routeStatusText}>Route status: {routeStatus}</Text> : null}
      </View>
    </View>
  );
}

export function TutorNavigationFallbackScreen({ route, navigate, goBack, errorMessage, onRetry }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const requestId = String(params.requestId || '').trim();
  const sessionId = String(params.sessionId || '').trim();
  const initialRequest = params.request || null;

  const [currentRequest, setCurrentRequest] = useState(initialRequest);
  const [liveTracking, setLiveTracking] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [currentTutorLoc, setCurrentTutorLoc] = useState(null);
  const [hasMarkedArrived, setHasMarkedArrived] = useState(false);
  const [isStartingTravel, setIsStartingTravel] = useState(false);
  const [isMarkingArrived, setIsMarkingArrived] = useState(false);
  const [isMarkingPreparing, setIsMarkingPreparing] = useState(false);
  const [isOpeningClass, setIsOpeningClass] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const lastLocationWriteRef = useRef(0);

  const destination = useMemo(() => {
    return normalizeCoordinate(liveTracking?.destination)
      || normalizeCoordinate(liveTracking?.studentLocation)
      || getDestinationFromRequest(currentRequest || initialRequest);
  }, [currentRequest, initialRequest, liveTracking?.destination, liveTracking?.studentLocation]);

  const currentLiveStatus = String(liveTracking?.status || currentRequest?.status || initialRequest?.status || 'accepted').toLowerCase();
  const isAccepted = currentLiveStatus === 'accepted';
  const isTravelling = ['travelling', 'traveling', 'in_transit'].includes(currentLiveStatus);
  const isArrived = ['waiting_student', 'arrived'].includes(currentLiveStatus) || hasMarkedArrived;
  const isPreparing = currentLiveStatus === 'preparing_for_lesson';
  const isInSession = ['in_session', 'in_progress'].includes(currentLiveStatus);

  const safety = useMemo(() => {
    return extractSafetySnapshot(currentRequest || initialRequest || liveTracking);
  }, [currentRequest, initialRequest, liveTracking]);

  const studentName = liveTracking?.studentName || currentRequest?.studentName || initialRequest?.studentName || 'Student';
  const studentAddress = currentRequest?.studentAddress || currentRequest?.locationAddress || initialRequest?.studentAddress || initialRequest?.locationAddress || 'Student location';
  const subject = currentRequest?.subject || initialRequest?.subject || 'Class';
  const statusCopy = getStatusCopy(currentLiveStatus);
  const distanceText = formatDistance(liveTracking?.distanceRemainingMeters || liveTracking?.distanceMeters);
  const etaText = formatEta(liveTracking?.etaSeconds || liveTracking?.durationSeconds);

  // 1-second live ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Grace countdown calculations (5 minutes = 300,000 ms)
  const arrivalGraceEndsAt = Number(
    currentRequest?.arrivalGraceEndsAt
    || liveTracking?.arrivalGraceEndsAt
    || (currentRequest?.arrivedAt ? currentRequest.arrivedAt + 5 * 60 * 1000 : 0)
  );
  const remainingArrivalGraceMs = arrivalGraceEndsAt ? Math.max(0, arrivalGraceEndsAt - now) : 0;

  const prepGraceEndsAt = Number(
    currentRequest?.preparationGraceEndsAt
    || liveTracking?.preparationGraceEndsAt
    || (currentRequest?.preparingStartedAt ? currentRequest.preparingStartedAt + 5 * 60 * 1000 : 0)
  );
  const remainingPrepGraceMs = prepGraceEndsAt ? Math.max(0, prepGraceEndsAt - now) : 0;

  useEffect(() => {
    if (!requestId) return () => {};
    return subscribeToLiveTracking(requestId, setLiveTracking, () => null);
  }, [requestId]);

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

  // Keep streaming live GPS updates to RTDB
  useEffect(() => {
    if (!requestId || !user?.uid) return () => {};
    let isActive = true;
    let locationWatchSub = null;

    async function streamLocation(loc) {
      if (!isActive || !loc) return;
      setCurrentTutorLoc(loc);

      const nowMs = Date.now();
      if (nowMs - lastLocationWriteRef.current >= 3000) {
        lastLocationWriteRef.current = nowMs;
        await updateLiveTracking(requestId, {
          tutorId: user.uid,
          tutorLocation: loc,
          status: currentLiveStatus,
          updatedAtMs: nowMs,
        }).catch(() => null);
        await saveUserLiveLocation(user.uid, loc).catch(() => null);
      }
    }

    async function initTracking() {
      // 1. Immediately push best available location so student sees tutor location without waiting
      const initialLoc = await getBestAvailableLocation(user).catch(() => null);
      if (initialLoc) {
        await streamLocation(initialLoc);
      }

      // 2. Start continuous watchPositionAsync for real-time live GPS streaming
      try {
        const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (perm?.status === 'granted' || String(perm?.status || '').toLowerCase() === 'granted') {
          locationWatchSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 3,
              timeInterval: 3000,
            },
            (pos) => {
              if (pos?.coords) {
                const norm = normalizeLocation(pos.coords, 'device');
                if (norm) {
                  streamLocation(norm);
                }
              }
            }
          );
        }
      } catch (watchErr) {
        console.warn('[TutorNavigation] watchPositionAsync error:', watchErr?.message);
      }
    }

    initTracking();
    const interval = setInterval(async () => {
      const loc = await getCurrentLocationSnapshot().catch(() => null);
      if (loc) {
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
  }, [requestId, user?.uid, currentLiveStatus]);

  // Prime road-snapped polyline route into RTDB if not already present
  useEffect(() => {
    if (!requestId || !destination || !currentTutorLoc) return;
    if (liveTracking?.routeSnapshot?.encodedPolyline) return;

    let isCurrent = true;
    async function primeRoadRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentTutorLoc.longitude},${currentTutorLoc.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
        const resp = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Parakleo/1.0' } });
        const data = await resp.json().catch(() => ({}));
        if (!isCurrent || data?.code !== 'Ok' || !data.routes?.[0]?.geometry) return;
        const primary = data.routes[0];
        await updateLiveTracking(requestId, {
          routeSnapshot: {
            encodedPolyline: primary.geometry,
            overviewEncodedPolyline: primary.geometry,
            distanceMeters: Math.round(Number(primary.distance || 0)),
            durationSeconds: Math.round(Number(primary.duration || 0)),
            routeProvider: 'osrm',
            lastSuccessfulRouteFetchAtMs: Date.now(),
          },
          distanceRemainingMeters: Math.round(Number(primary.distance || 0)),
          etaSeconds: Math.round(Number(primary.duration || 0)),
          updatedAtMs: Date.now(),
        }).catch(() => null);
      } catch (err) {
        console.warn('[TutorNavigation] primeRoadRoute error:', err?.message);
      }
    }

    primeRoadRoute();
    return () => {
      isCurrent = false;
    };
  }, [requestId, destination, currentTutorLoc?.latitude, currentTutorLoc?.longitude, liveTracking?.routeSnapshot?.encodedPolyline]);

  // Auto-navigate to Active Session if session is already active
  const effSessionId = sessionId || currentRequest?.sessionId || requestId;
  useEffect(() => {
    if (isInSession) {
      navigate?.('TutorActiveSession', {
        sessionId: effSessionId,
        requestId,
        request: currentRequest || initialRequest,
      });
    }
  }, [currentLiveStatus, currentRequest, effSessionId, initialRequest, isInSession, navigate, requestId]);

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

  async function handleMarkArrived() {
    if (!requestId || isMarkingArrived) return;
    setIsMarkingArrived(true);
    setHasMarkedArrived(true);
    try {
      await markTutorArrived({
        requestId,
        sessionId: effSessionId,
        tutorId: user?.uid,
        distanceMeters: distanceToDestMeters || 0,
      });
    } catch (err) {
      console.warn('handleMarkArrived error:', err);
    } finally {
      setIsMarkingArrived(false);
    }
  }

  const hasAutoArrivedRef = useRef(false);
  useEffect(() => {
    if (isWithin50Meters && isTravelling && !hasMarkedArrived && !hasAutoArrivedRef.current) {
      hasAutoArrivedRef.current = true;
      handleMarkArrived();
    }
  }, [isWithin50Meters, isTravelling, hasMarkedArrived]);

  async function handleMarkPreparing() {
    if (!requestId || isMarkingPreparing) return;
    setIsMarkingPreparing(true);
    try {
      await markPreparingForLesson({
        requestId,
        sessionId: effSessionId,
        tutorId: user?.uid,
      });
    } catch (err) {
      console.warn('handleMarkPreparing error:', err);
    } finally {
      setIsMarkingPreparing(false);
    }
  }

  async function handleOpenClass() {
    if (isOpeningClass) return;
    setIsOpeningClass(true);

    const activeReq = currentRequest || initialRequest || null;

    try {
      await startInPersonSession({
        sessionId: effSessionId,
        requestId,
        tutorId: user?.uid,
        studentId: activeReq?.studentId,
        pricingSnapshot: activeReq?.pricingSnapshot,
        subject: activeReq?.subject || subject || 'Mathematics',
        topic: activeReq?.topic,
      }).catch((err) => console.warn('[TutorNavigation] startInPersonSession error:', err));
    } catch (err) {
      console.warn('[TutorNavigation] handleOpenClass catch:', err);
    } finally {
      setIsOpeningClass(false);
    }

    const navParams = {
      sessionId: effSessionId,
      requestId,
      request: activeReq,
    };

    if (typeof navigate === 'function') {
      navigate('TutorActiveSession', navParams);
    }
  }

  const handleCancelForSafety = async (reason) => {
    setShowSafetyModal(false);
    try {
      await cancelInPersonSession({
        requestId,
        sessionId: effSessionId,
        session: currentRequest,
        canceledBy: 'tutor',
        reason: reason || 'Tutor safety concern',
      });
    } catch (err) {
      console.warn('handleCancelForSafety error:', err);
    } finally {
      if (goBack) goBack();
      else if (navigate) navigate('TutorDashboard');
    }
  };

  const handleConfirmCancel = async (payload) => {
    setShowCancelModal(false);
    try {
      await cancelInPersonSession({
        requestId,
        sessionId: effSessionId,
        session: currentRequest,
        canceledBy: 'tutor',
        reason: payload?.reason || 'Canceled by tutor',
      });
    } catch (err) {
      console.warn('handleConfirmCancel error:', err);
    } finally {
      if (goBack) goBack();
      else if (navigate) navigate('TutorDashboard');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.fallbackMapArea}>
        <View style={styles.fallbackPulseRing}>
          <View style={styles.fallbackCenterPin}>
            <Ionicons name="navigate" size={32} color="#ffffff" />
          </View>
        </View>
        <Text style={styles.fallbackMapTitle}>Live Navigation Active</Text>
        <Text style={styles.fallbackMapSubtitle}>
          Your live GPS position is broadcasting to {studentName}.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => openExternalNavigation(destination, studentAddress)}
          style={styles.fallbackMapsPill}
        >
          <Ionicons name="map" size={18} color="#059669" />
          <Text style={styles.fallbackMapsPillText}>Open in Google Maps Navigation</Text>
          <Ionicons name="open-outline" size={16} color="#059669" />
        </Pressable>
      </View>

      {/* Top bar with Safety Shield and Cancel button */}
      <View style={styles.topBarWrap}>
        <View style={styles.topCard}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={goBack}
            style={styles.topIconButton}
          >
            <Ionicons name="chevron-back" size={26} color="#0f172a" />
          </Pressable>

          <View style={styles.topSubjectWrap}>
            <View style={styles.topSubjectPill}>
              <View style={styles.topSubjectDot} />
              <Text style={styles.topSubjectText} numberOfLines={1}>
                {subject}
              </Text>
            </View>
          </View>

          {/* Safety Shield Button (Phase 21) */}
          <Pressable
            accessibilityLabel="Safety Center"
            accessibilityRole="button"
            onPress={() => setShowSafetyModal(true)}
            style={[styles.topIconButton, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 }]}
          >
            <Ionicons name="shield-checkmark" size={20} color="#059669" />
          </Pressable>

          {/* Cancel Button (Phase 17) */}
          <Pressable
            accessibilityLabel="Cancel Request"
            accessibilityRole="button"
            onPress={() => setShowCancelModal(true)}
            style={[styles.topIconButton, { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1, marginLeft: 6 }]}
          >
            <Ionicons name="close" size={20} color="#dc2626" />
          </Pressable>
        </View>
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        <View style={styles.liveStatusHeader}>
          <View style={[styles.liveStatusIcon, { backgroundColor: `${statusCopy.tone}18` }]}>
            <Ionicons name={statusCopy.icon} size={24} color={statusCopy.tone} />
          </View>
          <View style={styles.liveStatusTextWrap}>
            <Text style={styles.liveStatusBadge}>{statusCopy.badge}</Text>
            <Text style={styles.liveStatusTitle}>{statusCopy.title}</Text>
            <Text style={styles.liveStatusSubtitle}>{statusCopy.subtitle}</Text>
          </View>
        </View>

        {/* Guardian Presence Safety Notice (REQ-011) */}
        {(safety.isMinor || safety.guardianPresenceRequired) ? (
          <View style={styles.guardianSafetyBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#d97706" />
            <View style={styles.guardianSafetyTextWrap}>
              <Text style={styles.guardianSafetyTitle}>
                {safety.isMinor ? 'Minor Learner (Guardian Required)' : 'Guardian Presence Required'}
              </Text>
              <Text style={styles.guardianSafetySub}>
                Parent/Guardian {safety.guardianName ? `(${safety.guardianName}) ` : ''}must be present during the in-person session.
              </Text>
            </View>
          </View>
        ) : null}

        {/* 50-Meter Geofence Notification (Milestone M4) */}
        {isWithin50Meters && !isArrived && !isPreparing ? (
          <View style={styles.geofenceBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.geofenceBannerText}>
              Within 50m of student! You have arrived.
            </Text>
          </View>
        ) : null}

        {/* 5-Minute Arrival Grace Period Banner (Milestone M4) */}
        {isArrived && !isPreparing ? (
          <View style={styles.graceTimerBanner}>
            <Ionicons name="timer-outline" size={18} color="#059669" />
            <Text style={styles.graceTimerText}>
              Arrival Grace:{' '}
              <Text style={styles.graceCountdown}>
                {formatGraceCountdown(remainingArrivalGraceMs)}
              </Text>{' '}
              (No billing)
            </Text>
          </View>
        ) : null}

        {/* 5-Minute Preparation Grace Period Banner (Milestone M4) */}
        {isPreparing ? (
          <View style={[styles.graceTimerBanner, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
            <Ionicons name="book-outline" size={18} color="#7c3aed" />
            <Text style={[styles.graceTimerText, { color: '#6d28d9' }]}>
              Preparation Grace:{' '}
              <Text style={[styles.graceCountdown, { color: '#6d28d9' }]}>
                {formatGraceCountdown(remainingPrepGraceMs)}
              </Text>
            </Text>
          </View>
        ) : null}

        {/* Physical Meeting 4-Digit PIN Card (Milestone M4) */}
        {(isArrived || isPreparing) ? (
          <View style={styles.pinCard}>
            <View style={styles.pinHeader}>
              <Ionicons name="keypad" size={18} color="#059669" />
              <Text style={styles.pinHeaderTitle}>PHYSICAL MEETING PIN</Text>
            </View>
            <Text style={styles.pinCode}>
              {currentRequest?.verificationPin || liveTracking?.verificationPin || '----'}
            </Text>
            <Text style={styles.pinSubtitle}>
              Show this 4-digit code to the student to verify arrival
            </Text>
          </View>
        ) : null}

        <View style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>{String(studentName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentLabel}>Student Destination</Text>
            <Text style={styles.studentName}>{studentName}</Text>
            <Text style={styles.studentAddress} numberOfLines={2}>{studentAddress}</Text>
          </View>
          <View style={styles.routeEstimateBox}>
            <Text style={styles.routeEstimateValue}>{etaText}</Text>
            <Text style={styles.routeEstimateLabel}>{distanceText}</Text>
          </View>
        </View>

        {/* Action Button Row */}
        <View style={styles.actionsRow}>
          {/* External Google Maps Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => openExternalNavigation(destination, studentAddress)}
            style={styles.externalMapsButton}
          >
            <Ionicons name="navigate" size={16} color="#047857" />
            <Text style={styles.externalMapsButtonText}>Google Maps</Text>
          </Pressable>

          {/* Lifecycle Action Buttons */}
          {isAccepted ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleStartTravel}
              disabled={isStartingTravel}
              style={styles.startTravelButton}
            >
              {isStartingTravel ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="car-sport" size={18} color="#ffffff" />
                  <Text style={styles.startTravelButtonText}>Start Travelling</Text>
                </>
              )}
            </Pressable>
          ) : isTravelling ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleMarkArrived}
              disabled={isMarkingArrived}
              style={[styles.arrivedButton, isWithin50Meters && { backgroundColor: '#059669' }]}
            >
              {isMarkingArrived ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="location" size={18} color="#ffffff" />
                  <Text style={styles.arrivedButtonText}>I Have Arrived</Text>
                </>
              )}
            </Pressable>
          ) : isArrived && !isPreparing ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleMarkPreparing}
                disabled={isMarkingPreparing}
                style={styles.preparingButton}
              >
                {isMarkingPreparing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="book" size={16} color="#ffffff" />
                    <Text style={styles.preparingButtonText}>Preparing</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isOpeningClass}
                onPress={handleOpenClass}
                style={[styles.primaryButton, isOpeningClass && styles.buttonDisabled]}
              >
                {isOpeningClass ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Start Lesson</Text>
                    <Ionicons name="play" size={16} color="#ffffff" />
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={isOpeningClass}
              onPress={handleOpenClass}
              style={[styles.primaryButton, isOpeningClass && styles.buttonDisabled]}
            >
              {isOpeningClass ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Start Lesson & Timer</Text>
                  <Ionicons name="play" size={18} color="#ffffff" />
                </>
              )}
            </Pressable>
          )}
        </View>

        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryButton}>
            <Ionicons name="refresh" size={14} color="#64748b" />
            <Text style={styles.retryButtonText}>Retry Navigation</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Safety Modal (Phase 21) */}
      <SafetySupportModal
        visible={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        onCancelForSafety={handleCancelForSafety}
        userRole="tutor"
        currentLocationText={studentAddress}
        safetySnapshot={safety}
        guardianPhone={safety.guardianPhone}
        guardianName={safety.guardianName}
      />

      {/* Cancellation Quote Modal (Phase 17) */}
      <CancellationQuoteModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={handleConfirmCancel}
        requestId={requestId}
        sessionId={effSessionId}
        currentStatus={currentLiveStatus}
        userRole="tutor"
      />
    </View>
  );
}

class TutorNavigationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[TutorNavigationErrorBoundary] Caught navigation error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <TutorNavigationFallbackScreen
          {...this.props}
          errorMessage={this.state.error?.message || 'Google Navigation native module is unavailable.'}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

export function TutorNavigationScreen(props) {
  if (!ANDROID_NAVIGATION_SDK) {
    return (
      <TutorNavigationFallbackScreen
        {...props}
        errorMessage="Google Navigation is unavailable on this device."
      />
    );
  }

  return (
    <TutorNavigationErrorBoundary {...props}>
      <TutorNavigationScreenInner {...props} />
    </TutorNavigationErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackMapArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 220,
  },
  fallbackPulseRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 60,
    height: 120,
    justifyContent: 'center',
    marginBottom: 20,
    width: 120,
  },
  fallbackCenterPin: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 36,
    elevation: 6,
    height: 72,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    width: 72,
  },
  fallbackMapTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  fallbackMapSubtitle: {
    color: '#a7f3d0',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  fallbackMapsPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 4,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  fallbackMapsPillText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  topBarWrap: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 48,
    zIndex: 100,
  },
  topCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
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
    backgroundColor: '#10b981',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  topSubjectText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    elevation: 20,
    gap: 12,
    left: 0,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    zIndex: 90,
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
    fontSize: 16,
    fontWeight: '800',
  },
  liveStatusSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  studentCard: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  studentAvatar: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  studentAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  studentName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  studentAddress: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  routeEstimateBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  routeEstimateValue: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '900',
  },
  routeEstimateLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#e11d48',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  warningText: {
    color: '#d97706',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '900',
  },
  externalMapsButton: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  externalMapsButtonText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '900',
  },
  externalMapsPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 20,
    flex: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  externalMapsPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  routeStatusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  retryButtonText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  arrivedButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 20,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  arrivedButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  guardianSafetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  guardianSafetyTextWrap: {
    flex: 1,
  },
  guardianSafetyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2,
  },
  guardianSafetySub: {
    fontSize: 11,
    color: '#b45309',
    lineHeight: 15,
    fontWeight: '500',
  },
  geofenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  geofenceBannerText: {
    flex: 1,
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },
  graceTimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },
  graceTimerText: {
    flex: 1,
    color: '#065f46',
    fontSize: 13,
    fontWeight: '600',
  },
  graceCountdown: {
    fontWeight: '800',
    color: '#059669',
    fontSize: 14,
  },
  startTravelButton: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 20,
    flex: 1.3,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  startTravelButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  preparingButton: {
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  preparingButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  pinCard: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  pinHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  pinHeaderTitle: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pinCode: {
    color: '#047857',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    marginVertical: 4,
  },
  pinSubtitle: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
