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

export async function geocodeAddress(addressString) {
  const query = String(addressString || '').trim();
  if (!query || query.toLowerCase() === 'current location' || query.toLowerCase() === 'my location') {
    return null;
  }
  try {
    const results = await Location.geocodeAsync(query);
    if (Array.isArray(results) && results.length > 0) {
      const best = results[0];
      return normalizeLocation(best, 'geocoded');
    }
  } catch (err) {
    console.warn('[geocodeAddress:error]', err?.message || err);
  }
  return null;
}

export async function resolveLocationFromOption(locationOption = 'My Location', { user = {}, customAddress = '', studentHomeAddress = '' } = {}) {
  const normOption = String(locationOption || 'My Location').trim();

  if (normOption === 'Home') {
    const homeCoords = normalizeLocation(user?.homeCoordinates || user?.homeLocation);
    if (homeCoords) {
      return homeCoords;
    }
    const cleanHomeAddress = String(studentHomeAddress || user?.homeAddress || user?.address || '').trim();
    if (cleanHomeAddress) {
      const geocoded = await geocodeAddress(cleanHomeAddress);
      if (geocoded) return geocoded;
    }
    return (await getBestAvailableLocation(user).catch(() => null)) || getProfileLocation(user);
  }

  if (normOption === 'Other') {
    const cleanCustom = String(customAddress || '').trim();
    if (cleanCustom) {
      const geocoded = await geocodeAddress(cleanCustom);
      if (geocoded) return geocoded;
    }
    return (await getBestAvailableLocation(user).catch(() => null)) || getProfileLocation(user);
  }

  // 'My Location' default
  const live = await getBestAvailableLocation(user).catch(() => null);
  return live || getProfileLocation(user);
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

export { normalizeLocation };
