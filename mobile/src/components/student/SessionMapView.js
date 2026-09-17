import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { fetchLiveRoute } from '../../services/directionsRouteService';
import { decodePolyline } from '../../utils/polyline';

const FALLBACK_REGION = {
  latitude: -25.7479,
  longitude: 28.2293,
  latitudeDelta: 0.055,
  longitudeDelta: 0.055,
};

function normalizeCoordinate(coordinate = null) {
  const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
  const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const heading = Number.isFinite(Number(coordinate?.heading ?? coordinate?.bearing))
    ? Number(coordinate?.heading ?? coordinate?.bearing)
    : null;

  return {
    latitude,
    longitude,
    heading,
    speed: Number.isFinite(Number(coordinate?.speed)) ? Number(coordinate.speed) : null,
  };
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Infinity;
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

function getCoordinateKey(origin = null, destination = null) {
  if (!origin || !destination) return '';
  return [
    origin.latitude.toFixed(5),
    origin.longitude.toFixed(5),
    destination.latitude.toFixed(5),
    destination.longitude.toFixed(5),
  ].join(':');
}

function formatEta(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'ETA updating';
  return `${Math.max(1, Math.ceil(numeric / 60))} min away`;
}

function formatDistance(meters) {
  const numeric = Number(meters);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Distance updating';
  if (numeric < 1000) return `${Math.round(numeric)} m route`;
  return `${(numeric / 1000).toFixed(1)} km route`;
}

export function SessionMapView({
  requestId = '',
  studentLocation,
  studentLocationName = 'Current Location',
  tutorName = 'Tutor',
  liveTracking,
}) {
  const mapRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasInitialFittedRef = useRef(false);
  const lastFetchedOriginRef = useRef(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeMeta, setRouteMeta] = useState(null);
  const [routeError, setRouteError] = useState('');

  const studentCoordinate = useMemo(
    () => normalizeCoordinate(
      liveTracking?.studentLocation
        || liveTracking?.destination
        || liveTracking?.meetingCoordinates
        || liveTracking?.studentCoordinates
        || studentLocation,
    ),
    [liveTracking?.destination, liveTracking?.meetingCoordinates, liveTracking?.studentCoordinates, liveTracking?.studentLocation, studentLocation],
  );

  const tutorCoordinate = useMemo(
    () => normalizeCoordinate(liveTracking?.tutorLocation),
    [liveTracking?.tutorLocation],
  );

  const routeSnapshot = liveTracking?.routeSnapshot || {};
  const decodedSnapshotPoints = useMemo(() => {
    const rawEncoded = routeSnapshot?.encodedPolyline
      || routeSnapshot?.overviewEncodedPolyline
      || liveTracking?.routePolylineOverviewEncoded
      || liveTracking?.routePolylineEncoded;
    if (rawEncoded) {
      const points = decodePolyline(rawEncoded);
      if (points.length >= 2) return points;
    }
    if (Array.isArray(routeSnapshot?.routeCoordinates) && routeSnapshot.routeCoordinates.length >= 2) {
      return routeSnapshot.routeCoordinates.map(normalizeCoordinate).filter(Boolean);
    }
    return [];
  }, [routeSnapshot, liveTracking?.routePolylineOverviewEncoded, liveTracking?.routePolylineEncoded]);

  const visibleRouteCoordinates = useMemo(() => {
    if (routeCoordinates.length >= 2) return routeCoordinates;
    if (decodedSnapshotPoints.length >= 2) return decodedSnapshotPoints;
    if (tutorCoordinate && studentCoordinate) return [tutorCoordinate, studentCoordinate];
    return [];
  }, [routeCoordinates, decodedSnapshotPoints, tutorCoordinate, studentCoordinate]);

  const initialRegion = useMemo(() => {
    const center = studentCoordinate || tutorCoordinate || FALLBACK_REGION;
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: FALLBACK_REGION.latitudeDelta,
      longitudeDelta: FALLBACK_REGION.longitudeDelta,
    };
  }, [studentCoordinate, tutorCoordinate]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.45,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!tutorCoordinate || !studentCoordinate) {
      setRouteCoordinates([]);
      setRouteMeta(null);
      setRouteError('');
      lastFetchedOriginRef.current = null;
      return undefined;
    }

    // If RTDB already pushed a valid road polyline snapshot from tutor/server, use it directly!
    if (decodedSnapshotPoints.length >= 2) {
      setRouteCoordinates(decodedSnapshotPoints);
      return undefined;
    }

    // Otherwise, check distance moved since last route query to avoid hammering directions API every 3s
    if (lastFetchedOriginRef.current) {
      const movedMeters = getDistanceMeters(
        lastFetchedOriginRef.current.latitude,
        lastFetchedOriginRef.current.longitude,
        tutorCoordinate.latitude,
        tutorCoordinate.longitude,
      );
      if (movedMeters < 150 && routeCoordinates.length >= 2) {
        return undefined;
      }
    }

    let isCurrent = true;

    async function loadRoute() {
      try {
        lastFetchedOriginRef.current = tutorCoordinate;
        const nextRoute = await fetchLiveRoute({
          requestId,
          origin: tutorCoordinate,
          destination: studentCoordinate,
        });

        if (!isCurrent) return;

        let nextCoordinates = [];
        if (nextRoute?.encodedPolyline || nextRoute?.overviewPolyline) {
          nextCoordinates = decodePolyline(nextRoute.encodedPolyline || nextRoute.overviewPolyline);
        }
        if (!nextCoordinates.length && Array.isArray(nextRoute?.routeCoordinates)) {
          nextCoordinates = nextRoute.routeCoordinates.map(normalizeCoordinate).filter(Boolean);
        }

        if (nextCoordinates.length >= 2) {
          setRouteCoordinates(nextCoordinates);
          setRouteMeta(nextRoute || null);
          setRouteError('');
        } else if (decodedSnapshotPoints.length >= 2) {
          setRouteCoordinates(decodedSnapshotPoints);
          setRouteMeta(nextRoute || null);
          setRouteError('');
        }
      } catch (err) {
        if (!isCurrent) return;
        if (decodedSnapshotPoints.length >= 2) {
          setRouteCoordinates(decodedSnapshotPoints);
        } else if (tutorCoordinate && studentCoordinate) {
          setRouteCoordinates([tutorCoordinate, studentCoordinate]);
        }
        setRouteError(err?.message || 'Route temporarily unavailable');
      }
    }

    loadRoute();

    return () => {
      isCurrent = false;
    };
  }, [decodedSnapshotPoints, requestId, studentCoordinate, tutorCoordinate]);

  const fitMapToRoute = useCallback(() => {
    const markers = [studentCoordinate, tutorCoordinate].filter(Boolean);
    if (markers.length < 2 || !mapRef.current) return;

    mapRef.current.fitToCoordinates(markers, {
      animated: true,
      edgePadding: {
        top: 120,
        right: 64,
        bottom: 260,
        left: 64,
      },
    });
  }, [studentCoordinate, tutorCoordinate]);

  useEffect(() => {
    if (!hasInitialFittedRef.current && studentCoordinate && tutorCoordinate) {
      hasInitialFittedRef.current = true;
      const timer = setTimeout(fitMapToRoute, 400);
      return () => clearTimeout(timer);
    }
  }, [fitMapToRoute, studentCoordinate, tutorCoordinate]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.webFallback]}>
        <Ionicons name="map" size={40} color="#059669" />
        <Text style={styles.webFallbackTitle}>Live map is available on mobile</Text>
        <Text style={styles.webFallbackText}>Your tutor route will appear here in the student app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        pointerEvents="none"
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled
        toolbarEnabled={false}
        mapPadding={{
          top: 96,
          right: 0,
          bottom: 250,
          left: 0,
        }}
      >
        {visibleRouteCoordinates.length >= 2 ? (
          <Polyline
            coordinates={visibleRouteCoordinates}
            strokeColor="#059669"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {studentCoordinate ? (
          <Marker
            coordinate={studentCoordinate}
            title="Your location"
            description={studentLocationName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.studentLocationWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.45],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />
              <View style={styles.studentHalo} />
              <View style={styles.studentPin}>
                <View style={styles.studentCenterDot} />
              </View>
            </View>
          </Marker>
        ) : null}

        {tutorCoordinate ? (
          <Marker
            coordinate={tutorCoordinate}
            title={tutorName}
            description="Tutor live location"
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={tutorCoordinate.heading || 0}
          >
            <View style={styles.tutorMarkerWrap}>
              <View
                style={[
                  styles.tutorDot,
                  tutorCoordinate.heading !== null && { transform: [{ rotate: `${tutorCoordinate.heading}deg` }] },
                ]}
              >
                <Ionicons name="car-sport" size={16} color="#ffffff" />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View style={styles.pickupBadge} pointerEvents="none">
        <View style={styles.pickupBadgeDot} />
        <Text style={styles.pickupBadgeText} numberOfLines={1}>{studentLocationName}</Text>
      </View>

      <View style={styles.routeBadge} pointerEvents="none">
        <Ionicons name={tutorCoordinate ? 'navigate' : 'hourglass-outline'} size={15} color="#059669" />
        <Text style={styles.routeBadgeText} numberOfLines={1}>
          {tutorCoordinate
            ? `${formatEta(liveTracking?.etaSeconds ?? routeMeta?.durationSeconds ?? liveTracking?.durationSeconds)} • ${formatDistance(liveTracking?.distanceRemainingMeters ?? liveTracking?.distanceMeters ?? routeMeta?.distanceMeters)}`
            : 'Waiting for tutor live location'}
        </Text>
      </View>

      {studentCoordinate && tutorCoordinate ? (
        <Pressable
          accessibilityLabel="Recenter map"
          accessibilityRole="button"
          onPress={fitMapToRoute}
          style={styles.recenterButton}
        >
          <Ionicons name="scan-outline" size={20} color="#0f172a" />
        </Pressable>
      ) : null}

      {routeError ? (
        <View style={styles.routeErrorBadge} pointerEvents="none">
          <Ionicons name="warning-outline" size={14} color="#92400e" />
          <Text style={styles.routeErrorText} numberOfLines={1}>{routeError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  webFallbackTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  webFallbackText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  tutorMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorDot: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#ffffff',
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    width: 34,
  },
  studentLocationWrap: {
    alignItems: 'center',
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  pulseRing: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderRadius: 50,
    borderWidth: 1.5,
    height: 72,
    position: 'absolute',
    width: 72,
  },
  studentHalo: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 22,
    height: 38,
    position: 'absolute',
    width: 38,
  },
  studentPin: {
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 3,
    height: 24,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    width: 24,
  },
  studentCenterDot: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pickupBadge: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    left: 16,
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    top: 112,
  },
  pickupBadgeDot: {
    backgroundColor: '#10b981',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pickupBadgeText: {
    color: '#ffffff',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  routeBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d1fae5',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '74%',
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    top: 112,
  },
  routeBadgeText: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  routeErrorBadge: {
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    left: 16,
    maxWidth: '78%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 152,
  },
  routeErrorText: {
    color: '#92400e',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  recenterButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 340,
    elevation: 95,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    width: 44,
    zIndex: 95,
  },
});
