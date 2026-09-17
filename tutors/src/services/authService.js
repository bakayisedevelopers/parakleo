import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseClients } from '../firebase/config';
import { buildDefaultTutorProfile, deleteUserProfile, getUserProfile, upsertTutorProfile } from './userService';

export const STUDENT_LOGIN_BLOCKED_CODE = 'STUDENT_LOGIN_BLOCKED';

function normalizeTutorUser(firebaseUser, profile = {}) {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailVerified: Boolean(firebaseUser.emailVerified),
    displayName: profile.displayName || firebaseUser.displayName || '',
    fullName: profile.fullName || profile.displayName || firebaseUser.displayName || '',
    role: 'tutor',
    activeRole: 'tutor',
    roles: ['tutor'],
    ...profile,
  };
}

export function subscribeToAuthChanges(callback, onError) {
  const { auth } = getFirebaseClients();

  return onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      let profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        profile = buildDefaultTutorProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Tutor',
        });
        await upsertTutorProfile(firebaseUser.uid, profile);
      }

      callback(normalizeTutorUser(firebaseUser, profile));
    } catch (error) {
      onError?.(error);
      callback(null);
    }
  });
}

export async function loginWithEmail(email, password) {
  const { auth } = getFirebaseClients();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  let profile = await getUserProfile(credential.user.uid);
  if (!profile) {
    profile = buildDefaultTutorProfile({
      uid: credential.user.uid,
      email: credential.user.email || '',
      displayName: credential.user.displayName || 'Tutor',
    });
    await upsertTutorProfile(credential.user.uid, profile);
  }
  return normalizeTutorUser(credential.user, profile);
}

export async function signupWithEmail({ email, password, fullName }) {
  const { auth } = getFirebaseClients();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: fullName });

  const initialProfile = buildDefaultTutorProfile({
    uid: credential.user.uid,
    email: credential.user.email || '',
    displayName: fullName,
  });

  await upsertTutorProfile(credential.user.uid, initialProfile);
  return normalizeTutorUser(credential.user, initialProfile);
}

export async function logoutUser() {
  const { auth } = getFirebaseClients();
  await signOut(auth);
}

export async function deleteAccount() {
  const { auth } = getFirebaseClients();
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  await deleteUserProfile(currentUser.uid);
  await deleteUser(currentUser);
}
