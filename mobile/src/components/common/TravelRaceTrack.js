import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatEta(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return '--';
  }
  const numeric = Math.max(0, Math.round(Number(seconds)));
  if (numeric < 60) return '< 1 min';
  const mins = Math.round(numeric / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatDistance(meters) {
  if (meters === null || meters === undefined || Number.isNaN(Number(meters))) {
    return '--';
  }
  const numeric = Math.max(0, Number(meters));
  if (numeric < 1000) return `${Math.round(numeric)} m`;
  return `${(numeric / 1000).toFixed(1)} km`;
}

export function TravelRaceTrack({
  currentStatus = '',
  tutorLocation = null,
  destinationAddress = 'Meeting Location',
  tutorName = 'Tutor',
  liveTracking = null,
  containerStyle = null,
}) {
  const normStatus = String(currentStatus || liveTracking?.status || '').toLowerCase();
  const isArrived = ['arrived', 'waiting_student', 'preparing_for_lesson', 'in_session', 'in_progress', 'completed'].includes(normStatus);
  const isPreparing = normStatus === 'preparing_for_lesson';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulse effect for the vehicle marker
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Distance and ETA metrics
  const remainingDistanceMeters = liveTracking?.distanceRemainingMeters
    ?? liveTracking?.routeSnapshot?.distanceMeters
    ?? null;
  const remainingEtaSeconds = liveTracking?.etaSeconds
    ?? liveTracking?.routeSnapshot?.durationSeconds
    ?? null;

  // Compute progress ratio (0 to 1)
  const initialDistanceMeters = useMemo(() => {
    return liveTracking?.initialDistanceMeters
      || liveTracking?.routeSnapshot?.distanceMeters
      || (remainingDistanceMeters ? remainingDistanceMeters * 1.2 : 2000);
  }, [liveTracking?.initialDistanceMeters, liveTracking?.routeSnapshot?.distanceMeters, remainingDistanceMeters]);

  const targetProgress = useMemo(() => {
    if (isArrived) return 1;
    if (!remainingDistanceMeters || !initialDistanceMeters) return 0.05;
    const computed = 1 - (remainingDistanceMeters / initialDistanceMeters);
    return Math.max(0.05, Math.min(0.92, computed));
  }, [isArrived, remainingDistanceMeters, initialDistanceMeters]);

  // Smoothly animate the racer position along the track
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [targetProgress, progressAnim]);

  const progressPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '92%'],
  });

  const progressFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '100%'],
  });

  const speedKmh = useMemo(() => {
    const rawSpeed = Number(tutorLocation?.speed ?? liveTracking?.tutorLocation?.speed ?? 0);
    if (!Number.isFinite(rawSpeed) || rawSpeed <= 0) return null;
    return Math.round(rawSpeed * 3.6); // m/s to km/h
  }, [tutorLocation?.speed, liveTracking?.tutorLocation?.speed]);

  return (
    <View style={[styles.card, containerStyle]}>
      {/* Top Header HUD: Big ETA & Distance */}
      <View style={styles.hudHeader}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudEyebrow}>
            {isPreparing
              ? 'PREPARATION GRACE'
              : isArrived
              ? 'TUTOR ARRIVED'
              : 'ESTIMATED ARRIVAL'}
          </Text>
          <View style={styles.hudEtaRow}>
            <Text
              style={[
                styles.hudEtaValue,
                isPreparing && { color: '#7c3aed' },
                isArrived && !isPreparing && { color: '#2563eb' },
              ]}
            >
              {isPreparing
                ? 'Preparing'
                : isArrived
                ? 'Arrived'
                : formatEta(remainingEtaSeconds)}
            </Text>
            {!isArrived && remainingEtaSeconds !== null && (
              <View style={styles.livePulseBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePulseText}>LIVE</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.hudRight}>
          <Text style={styles.hudDistValue}>
            {isArrived ? 'At Location' : formatDistance(remainingDistanceMeters)}
          </Text>
          <Text style={styles.hudDistLabel}>
            {speedKmh ? `${speedKmh} km/h` : isArrived ? 'Meeting point' : 'remaining'}
          </Text>
        </View>
      </View>

      {/* Race Track Container */}
      <View style={styles.trackContainer}>
        {/* Asphalt Road Base */}
        <View style={styles.trackRoad}>
          {/* Dashed Center Road Stripe */}
          <View style={styles.roadDashes}>
            {Array.from({ length: 9 }).map((_, idx) => (
              <View key={`dash-${idx}`} style={styles.roadDash} />
            ))}
          </View>

          {/* Active Progress Fill */}
          <Animated.View
            style={[
              styles.trackFill,
              { width: progressFillWidth },
              isPreparing && { backgroundColor: '#8b5cf6' },
              isArrived && !isPreparing && { backgroundColor: '#3b82f6' },
            ]}
          />
        </View>

        {/* Start Line Marker */}
        <View style={styles.startMarker}>
          <View style={styles.startDot} />
          <Text style={styles.startLabel}>Start</Text>
        </View>

        {/* Moving Racer Vehicle */}
        <Animated.View
          style={[
            styles.racerVehicleWrap,
            { left: progressPercent },
          ]}
        >
          {/* Outer Pulse Glow */}
          <Animated.View
            style={[
              styles.racerPulseHalo,
              {
                transform: [{ scale: pulseAnim }],
                borderColor: isPreparing ? '#c4b5fd' : isArrived ? '#93c5fd' : '#6ee7b7',
              },
            ]}
          />

          {/* Car Icon Circle */}
          <View
            style={[
              styles.racerCarCircle,
              isPreparing && { backgroundColor: '#7c3aed' },
              isArrived && !isPreparing && { backgroundColor: '#2563eb' },
            ]}
          >
            <Ionicons
              name={isArrived ? 'checkmark' : 'car-sport'}
              size={17}
              color="#ffffff"
            />
          </View>

          <Text style={styles.racerLabel} numberOfLines={1}>
            {isArrived ? 'Arrived' : tutorName || 'Tutor'}
          </Text>
        </Animated.View>

        {/* Finish Line Marker */}
        <View style={styles.finishMarker}>
          <View style={styles.finishFlagCircle}>
            <Ionicons name="flag" size={13} color="#ffffff" />
          </View>
          <Text style={styles.finishLabel}>Finish</Text>
        </View>
      </View>

      {/* Bottom Destination Strip */}
      <View style={styles.bottomInfoStrip}>
        <Ionicons name="location-sharp" size={15} color="#64748b" />
        <Text style={styles.destinationText} numberOfLines={1}>
          {destinationAddress}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    marginHorizontal: 16,
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 6,
  },
  hudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  hudLeft: {
    flex: 1,
  },
  hudEyebrow: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  hudEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudEtaValue: {
    color: '#10b981',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  livePulseDot: {
    backgroundColor: '#10b981',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  livePulseText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hudRight: {
    alignItems: 'flex-end',
  },
  hudDistValue: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  hudDistLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  trackContainer: {
    height: 74,
    justifyContent: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  trackRoad: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  roadDashes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 2,
  },
  roadDash: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 1,
    height: 3,
    width: 14,
  },
  trackFill: {
    backgroundColor: '#10b981',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  startMarker: {
    alignItems: 'center',
    left: 2,
    position: 'absolute',
    top: 14,
  },
  startDot: {
    backgroundColor: '#10b981',
    borderColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  startLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 18,
  },
  finishMarker: {
    alignItems: 'center',
    position: 'absolute',
    right: 2,
    top: 10,
  },
  finishFlagCircle: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  finishLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 14,
  },
  racerVehicleWrap: {
    alignItems: 'center',
    marginLeft: -18,
    position: 'absolute',
    top: 2,
    zIndex: 10,
  },
  racerPulseHalo: {
    borderRadius: 20,
    borderWidth: 2,
    bottom: 12,
    left: -2,
    position: 'absolute',
    right: -2,
    top: -2,
  },
  racerCarCircle: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2.5,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    width: 36,
  },
  racerLabel: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  bottomInfoStrip: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  destinationText: {
    color: '#94a3b8',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});
