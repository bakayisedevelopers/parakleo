import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, deleteDoc, serverTimestamp, onSnapshot, query, where, orderBy, runTransaction, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_FIREBASE_ENV_FIELDS = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
];

export const missingFirebaseEnvKeys = REQUIRED_FIREBASE_ENV_FIELDS
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const hasFirebaseEnv = missingFirebaseEnvKeys.length === 0;
const isProductionBuild = import.meta.env.PROD;

export class FirebaseConfigError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'FirebaseConfigError';
    this.missingKeys = options.missingKeys ?? [];
    this.cause = options.cause;
  }
}

let cachedClients = null;

function initializeFirebase() {
  if (cachedClients) {
    return cachedClients;
  }

  try {
    const app = initializeApp(firebaseConfig);
    cachedClients = {
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
      // Auth module functions
      authModule: {
        onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        updateProfile,
        signOut,
        deleteUser,
      },
      // Firestore module functions
      firestoreModule: {
        doc,
        getDoc,
        getDocs,
        setDoc,
        updateDoc,
        addDoc,
        collection,
        deleteDoc,
        serverTimestamp,
        onSnapshot,
        query,
        where,
        orderBy,
        runTransaction,
        writeBatch,
      },
      storageModule: {
        ref,
        uploadBytes,
        getDownloadURL,
      },
    };
    return cachedClients;
  } catch (error) {
    if (isProductionBuild) {
      throw new FirebaseConfigError(
        'Firebase initialization failed in production. Check Firebase environment variables and project configuration.',
        { cause: error },
      );
    }
    console.warn('Firebase SDK unavailable, using local mock mode.', error);
    return null;
  }
}

export async function getFirebaseClients() {
  if (!hasFirebaseEnv) {
    if (isProductionBuild) {
      throw new FirebaseConfigError(
        `Missing required Firebase environment variables: ${missingFirebaseEnvKeys.join(', ')}`,
        { missingKeys: missingFirebaseEnvKeys },
      );
    }
    return null;
  }

  return initializeFirebase();
}
