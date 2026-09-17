import * as Location from 'expo-location';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { getFirebaseClients } from '../firebase/config';

export function normalizeLocation(location = null, source = 'profile') {
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
    user.liveLocation
      || user.homeLocation
      || user.location
      || user.tutorProfile?.liveLocation
      || user.tutorProfile?.homeLocation
      || user.tutorProfile?.location
      || null,
    'profile',
  );
}

function isGranted(permission) {
  return String(permission?.status || '').toLowerCase() === 'granted';
}

export async function getCurrentLocationSnapshot() {
  let servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled && Platform.OS === 'android') {
    await Location.enableNetworkProviderAsync().catch(() => null);
    servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
  }
  if (!servicesEnabled) {
    return null;
  }

  const currentPermission = await Location.getForegroundPermissionsAsync().catch(() => null);
  const permission = isGranted(currentPermission)
    ? currentPermission
    : await Location.requestForegroundPermissionsAsync();
  if (!isGranted(permission)) {
    return null;
  }

  // 1. Read last known location as immediate result
  const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);

  // 2. Race getCurrentPositionAsync with a 3.5s timeout
  const currentPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
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

export async function resolveTutorDispatchLocation(user = {}) {
  let servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled && Platform.OS === 'android') {
    await Location.enableNetworkProviderAsync().catch(() => null);
    servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
  }

  if (!servicesEnabled) {
    return {
      location: null,
      source: 'none',
      message: 'Turn on device location services before going online for in-person requests.',
      canOpenSettings: true,
    };
  }

  const currentPermission = await Location.getForegroundPermissionsAsync().catch(() => null);
  const permission = isGranted(currentPermission)
    ? currentPermission
    : await Location.requestForegroundPermissionsAsync();

  if (!isGranted(permission)) {
    const fallback = getProfileLocation(user);
    return {
      location: fallback,
      source: fallback ? 'profile' : 'none',
      message: permission?.canAskAgain === false
        ? 'Location permission is blocked. Enable it in app settings so nearby students can be matched to you.'
        : 'Location permission is required before going online for in-person requests.',
      canOpenSettings: permission?.canAskAgain === false,
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const location = normalizeLocation(position?.coords, 'device');
    if (location) {
      return {
        location,
        source: 'device',
        message: '',
        canOpenSettings: false,
      };
    }
  } catch (_error) {
    // Fall back to saved profile/home coordinates below.
  }

  const fallback = getProfileLocation(user);
  return {
    location: fallback,
    source: fallback ? 'profile' : 'none',
    message: fallback
      ? 'Using your saved location because the app could not read your current GPS position.'
      : 'The app could not read your current location. Please check location permission and try again.',
    canOpenSettings: !fallback,
  };
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
      tutorProfile: {
        liveLocation: normalized,
        location: normalized,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalized;
}
