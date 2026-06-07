const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD8lPjxXRspqgoDcQDPRxJBZOCFi4w5Uxo',
  authDomain: 'parakleo.firebaseapp.com',
  projectId: 'parakleo',
  storageBucket: 'parakleo.firebasestorage.app',
  messagingSenderId: '739203614866',
  appId: '1:739203614866:web:0ad34cefec01ea6a5b7e4b',
};

function readPublicEnv(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export const FIREBASE_PUBLIC_CONFIG = {
  apiKey: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, DEFAULT_FIREBASE_CONFIG.authDomain),
  projectId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, DEFAULT_FIREBASE_CONFIG.appId),
};

export const WEB_APP_BASE_URL = readPublicEnv(process.env.EXPO_PUBLIC_WEB_APP_URL, 'https://parakleo.bakayise.com').replace(/\/+$/, '');
export const FIREBASE_EMULATOR_HOST = readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST, '10.0.2.2');
export const USE_FIREBASE_EMULATORS = readPublicEnv(process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS) === 'true';
