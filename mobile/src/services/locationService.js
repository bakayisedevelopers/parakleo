import * as Location from 'expo-location';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

function normalizeLocation(location = null, source = 'profile') {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(location?.accuracy)) ? Number(location.accuracy) : null,
    altitude: Number.isFinite(Number(location?.altitude)) ? Number(location.altitude) : null,
    altitudeAccuracy: Number.isFinite(Number(location?.altitudeAccuracy)) ? Number(location.altitudeAccuracy) : null,
    heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : null,
    speed: Number.isFinite(Number(location?.speed)) ? Number(location.speed) : null,
    updatedAtMs: Number.isFinite(Number(location?.updatedAtMs)) ? Number(location.updatedAtMs) : Date.now(),
    source,
  };
}

function getProfileLocation(user = {}) {
  return normalizeLocation(
    user.liveLocation || user.homeLocation || user.location || user.studentProfile?.location || null,
    'profile',
  );
}

export async function getCurrentLocationSnapshot() {
  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (permission?.status !== Location.PermissionStatus.GRANTED && String(permission?.status || '').toLowerCase() !== 'granted') {
    return null;
  }

  const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);

  const currentPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: true,
  }).catch(() => null);

  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
  const position = await Promise.race([currentPromise, timeoutPromise]);

  const coords = position?.coords || lastKnown?.coords;
  if (!coords) {
    return null;
  }

  return normalizeLocation(coords, 'device');
}

export async function getBestAvailableLocation(user = {}) {
  const currentLocation = await getCurrentLocationSnapshot().catch(() => null);
  return currentLocation || getProfileLocation(user);
}

export async function saveUserLiveLocation(uid, location) {
  const normalized = normalizeLocation(location, location?.source || 'device');
  if (!uid || !normalized) return null;

  const { db } = getFirebaseClients();
  await setDoc(
    doc(db, 'users', uid),
    {
      liveLocation: normalized,
      location: normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalized;
}
