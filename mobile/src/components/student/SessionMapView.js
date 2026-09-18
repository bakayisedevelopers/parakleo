import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { fetchLiveRoute } from '../../services/directionsRouteService';
import { TravelRaceTrack } from '../common/TravelRaceTrack';

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

export function SessionMapView({
  requestId = '',
  studentLocation,
  studentLocationName = 'Meeting Location',
  tutorName = 'Tutor',
  liveTracking,
  currentStatus = '',
}) {
  const lastFetchedOriginRef = useRef(null);

  const studentCoordinate = useMemo(
    () => normalizeCoordinate(
      liveTracking?.destination
        || liveTracking?.meetingCoordinates
        || liveTracking?.studentLocation
        || liveTracking?.studentCoordinates
        || studentLocation,
    ),
    [liveTracking?.destination, liveTracking?.meetingCoordinates, liveTracking?.studentCoordinates, liveTracking?.studentLocation, studentLocation],
  );

  const tutorCoordinate = useMemo(
    () => normalizeCoordinate(liveTracking?.tutorLocation),
    [liveTracking?.tutorLocation],
  );

  // Periodically query Routes API (Cloud Function with OSRM fallback) to update distance & ETA in RTDB
  useEffect(() => {
    if (!tutorCoordinate || !studentCoordinate || !requestId) return;
    const norm = String(currentStatus || '').toLowerCase();
    if (['arrived', 'waiting_student', 'preparing_for_lesson', 'in_session', 'in_progress', 'completed'].includes(norm)) {
      return;
    }

    if (lastFetchedOriginRef.current) {
      const movedMeters = getDistanceMeters(
        lastFetchedOriginRef.current.latitude,
        lastFetchedOriginRef.current.longitude,
        tutorCoordinate.latitude,
        tutorCoordinate.longitude,
      );
      if (movedMeters < 150) return;
    }

    lastFetchedOriginRef.current = tutorCoordinate;
    fetchLiveRoute({
      requestId,
      origin: tutorCoordinate,
      destination: studentCoordinate,
    }).catch(() => null);
  }, [tutorCoordinate, studentCoordinate, requestId, currentStatus]);

  return (
    <View style={styles.container}>
      <TravelRaceTrack
        currentStatus={currentStatus}
        tutorLocation={tutorCoordinate}
        destinationAddress={studentLocationName}
        tutorName={tutorName}
        liveTracking={liveTracking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
