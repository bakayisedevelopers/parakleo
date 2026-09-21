import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import {
  FIREBASE_EMULATOR_HOST,
  FIREBASE_PUBLIC_CONFIG,
  USE_FIREBASE_EMULATORS,
} from '../constants/runtimeConfig';

const firebaseConfig = FIREBASE_PUBLIC_CONFIG;
const projectId = firebaseConfig.projectId || 'parakleo';
let emulatorsConnected = false;
let authInstance = null;
let firestoreInstance = null;

function getFirebaseAuth(app) {
  if (authInstance) {
    return authInstance;
  }

  try {
    authInstance = initializeAuth(app, {
      persistence: inMemoryPersistence,
    });
  } catch (error) {
    authInstance = getAuth(app);
  }

  return authInstance;
}

function getFirebaseFirestore(app) {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
      useFetchStreams: false,
    });
  } catch (error) {
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}

export function getFirebaseClients() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getFirebaseAuth(app);
  const db = getFirebaseFirestore(app);
  const realtimeDb = getDatabase(app, firebaseConfig.databaseURL);
  const storage = getStorage(app);

  if (USE_FIREBASE_EMULATORS && !emulatorsConnected) {
    connectAuthEmulator(auth, `http://${FIREBASE_EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, FIREBASE_EMULATOR_HOST, 8080);
    connectDatabaseEmulator(realtimeDb, FIREBASE_EMULATOR_HOST, 9000);
    connectStorageEmulator(storage, FIREBASE_EMULATOR_HOST, 9199);
    emulatorsConnected = true;
  }

  return { app, auth, db, realtimeDb, storage };
}

export function getFunctionEndpoint(functionName) {
  if (USE_FIREBASE_EMULATORS) {
    return `http://${FIREBASE_EMULATOR_HOST}:5001/${projectId}/us-central1/${functionName}`;
  }

  return `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`;
}
