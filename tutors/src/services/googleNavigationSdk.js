import { Fragment } from 'react';

let navigationSdk = null;

try {
  navigationSdk = require('@googlemaps/react-native-navigation-sdk');
} catch (_error) {
  navigationSdk = null;
}

const noopAsync = async () => {};
const noopNavigationController = {
  areTermsAccepted: async () => false,
  showTermsAndConditionsDialog: async () => false,
  resetTermsAccepted: noopAsync,
  init: async () => 'unknownError',
  cleanup: noopAsync,
  getCurrentRouteSegment: async () => null,
  getRouteSegments: async () => [],
  getCurrentTimeAndDistance: async () => null,
  getTraveledPath: async () => [],
  getNavSDKVersion: async () => '',
  setDestination: async () => 'UNKNOWN',
  setDestinations: async () => 'UNKNOWN',
  continueToNextDestination: async () => ({ waypoint: null }),
  clearDestinations: noopAsync,
  startGuidance: noopAsync,
  stopGuidance: noopAsync,
  setAbnormalTerminatingReportingEnabled: () => {},
  setSpeedAlertOptions: () => {},
  setAudioGuidanceType: () => {},
  stopUpdatingLocation: () => {},
  startUpdatingLocation: () => {},
  setBackgroundLocationUpdatesEnabled: () => {},
  setTurnByTurnLoggingEnabled: () => {},
};

export const googleNavigationSdkAvailable = Boolean(navigationSdk);
export const GoogleNavigationProvider = navigationSdk?.NavigationProvider || Fragment;
export const GoogleTaskRemovedBehavior = navigationSdk?.TaskRemovedBehavior || {
  CONTINUE_SERVICE: 0,
};
export const GoogleMapColorScheme = navigationSdk?.MapColorScheme || {
  FOLLOW_SYSTEM: 0,
  LIGHT: 1,
  DARK: 2,
};
export const GoogleNavigationSessionStatus = navigationSdk?.NavigationSessionStatus || {
  OK: 'OK',
  NOT_AUTHORIZED: 'notAuthorized',
  TERMS_NOT_ACCEPTED: 'termsNotAccepted',
  NETWORK_ERROR: 'networkError',
  LOCATION_PERMISSION_MISSING: 'locationPermissionMissing',
  UNKNOWN_ERROR: 'unknownError',
};
export const GoogleNavigationView = navigationSdk?.NavigationView || null;
export const GoogleRouteStatus = navigationSdk?.RouteStatus || {
  OK: 'OK',
  UNKNOWN: 'UNKNOWN',
};
export const GoogleTravelMode = navigationSdk?.TravelMode || {
  DRIVING: 0,
};

export function useGoogleNavigationSafe() {
  if (typeof navigationSdk?.useNavigation === 'function') {
    return navigationSdk.useNavigation();
  }

  return {
    navigationController: noopNavigationController,
    removeAllListeners: () => {},
    setOnArrival: () => {},
    setOnLocationChanged: () => {},
    setOnRemainingTimeOrDistanceChanged: () => {},
  };
}
