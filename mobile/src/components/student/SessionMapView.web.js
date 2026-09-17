import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatEta(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return '4 mins away';
  return `${Math.max(1, Math.ceil(numeric / 60))} min away`;
}

function formatDistance(meters) {
  const numeric = Number(meters);
  if (!Number.isFinite(numeric) || numeric <= 0) return '1.8 km';
  if (numeric < 1000) return `${Math.round(numeric)} m`;
  return `${(numeric / 1000).toFixed(1)} km`;
}

export function SessionMapView({
  requestId,
  studentLocation,
  studentLocationName = 'Your Location',
  tutorName = 'Tutor',
  liveTracking,
}) {
  const etaText = formatEta(liveTracking?.etaSeconds);
  const distanceText = formatDistance(liveTracking?.distanceRemainingMeters || liveTracking?.distanceMeters);

  return (
    <View style={styles.webMapContainer} pointerEvents="none">
      {/* Visual map grid texture */}
      <View style={styles.mapGridPattern}>
        <View style={styles.roadHorizontal1} />
        <View style={styles.roadHorizontal2} />
        <View style={styles.roadDiagonal} />
        <View style={styles.roadVertical} />
      </View>

      {/* Floating Web Tracking Banner */}
      <View style={styles.webTrackingCard}>
        <View style={styles.webTrackingHeader}>
          <View style={styles.pulseDot} />
          <Text style={styles.webTrackingTitle}>LIVE IN-PERSON ROUTE</Text>
        </View>
        <Text style={styles.webTrackingEta}>{etaText} ({distanceText})</Text>
        <Text style={styles.webTrackingSubtitle}>
          {tutorName} is travelling to {studentLocationName}
        </Text>
      </View>

      {/* Tutor Location Marker */}
      <View style={styles.tutorPin}>
        <View style={styles.tutorPinIcon}>
          <Ionicons name="car-sport" size={18} color="#ffffff" />
        </View>
        <Text style={styles.pinLabel}>{tutorName}</Text>
      </View>

      {/* Destination Marker */}
      <View style={styles.destinationPin}>
        <View style={styles.destinationPinIcon}>
          <Ionicons name="location" size={20} color="#059669" />
        </View>
        <Text style={styles.destinationLabel}>{studentLocationName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e6f4ea',
    overflow: 'hidden',
  },
  mapGridPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  roadHorizontal1: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
  },
  roadHorizontal2: {
    position: 'absolute',
    top: '65%',
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
  },
  roadDiagonal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '30%',
    width: 16,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '35deg' }],
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#cbd5e1',
  },
  roadVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '25%',
    width: 14,
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#cbd5e1',
  },
  webTrackingCard: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    maxWidth: 380,
  },
  webTrackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  webTrackingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  webTrackingEta: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064e3b',
    marginVertical: 2,
  },
  webTrackingSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  tutorPin: {
    position: 'absolute',
    top: '40%',
    left: '28%',
    alignItems: 'center',
  },
  tutorPinIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pinLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e3b',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  destinationPin: {
    position: 'absolute',
    top: '55%',
    right: '25%',
    alignItems: 'center',
  },
  destinationPinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#059669',
  },
  destinationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e3b',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
});
