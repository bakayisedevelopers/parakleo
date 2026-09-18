import { Alert, Linking, Platform } from 'react-native';

/**
 * Launches external turn-by-turn navigation app (Google Maps, Waze, Apple Maps)
 * with the destination coordinates.
 */
export async function openExternalNavigation({
  latitude,
  longitude,
  destinationName = 'Meeting Location',
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    Alert.alert('Invalid Destination', 'Destination coordinates are not available.');
    return;
  }

  const encodedName = encodeURIComponent(destinationName);

  if (Platform.OS === 'android') {
    // 1. Try Android Google Maps Navigation Intent (launches turn-by-turn mode directly)
    const googleNavIntent = `google.navigation:q=${lat},${lng}&mode=d`;
    try {
      const canOpen = await Linking.canOpenURL(googleNavIntent);
      if (canOpen) {
        await Linking.openURL(googleNavIntent);
        return;
      }
    } catch (_err) {
      // Continue to fallback
    }

    // 2. Try generic geo intent
    const geoUri = `geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`;
    try {
      const canOpenGeo = await Linking.canOpenURL(geoUri);
      if (canOpenGeo) {
        await Linking.openURL(geoUri);
        return;
      }
    } catch (_err) {
      // Continue to fallback
    }

    // 3. Fallback to Google Maps Web / App Universal Link
    const webGoogleMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    await Linking.openURL(webGoogleMaps).catch((err) => {
      Alert.alert('Navigation Error', 'Could not open maps application: ' + err.message);
    });
    return;
  }

  if (Platform.OS === 'ios') {
    // 1. Try Apple Maps
    const appleMapsUri = `maps://?daddr=${lat},${lng}&dirflg=d`;
    try {
      const canApple = await Linking.canOpenURL(appleMapsUri);
      if (canApple) {
        await Linking.openURL(appleMapsUri);
        return;
      }
    } catch (_err) {
      // Continue to fallback
    }

    // 2. Try Google Maps on iOS
    const comGoogleMaps = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    try {
      const canGoogle = await Linking.canOpenURL(comGoogleMaps);
      if (canGoogle) {
        await Linking.openURL(comGoogleMaps);
        return;
      }
    } catch (_err) {
      // Continue to fallback
    }

    // 3. Fallback to browser
    const webGoogleMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    await Linking.openURL(webGoogleMaps).catch((err) => {
      Alert.alert('Navigation Error', 'Could not open maps application: ' + err.message);
    });
    return;
  }

  // Web or fallback
  const webGoogleMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  await Linking.openURL(webGoogleMaps).catch((err) => {
    Alert.alert('Navigation Error', 'Could not open maps: ' + err.message);
  });
}

/**
 * Open Waze directly if tutor prefers Waze
 */
export async function openWazeNavigation({ latitude, longitude }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const wazeUri = `waze://?ll=${lat},${lng}&navigate=yes`;
  try {
    const canOpen = await Linking.canOpenURL(wazeUri);
    if (canOpen) {
      await Linking.openURL(wazeUri);
      return;
    }
  } catch (_err) {}

  const wazeWeb = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  await Linking.openURL(wazeWeb).catch(() => {});
}
