import { getFirebaseClients } from '../firebase/config';
import { EMAIL_EVENT_TYPES, queueEmailEvent } from './emailEventService';
import { syncStudentGrowth } from './studentGrowthService';
import { deleteUserProfile, getUserProfile, upsertUserProfile } from './userService';

const MOCK_USER_KEY = 'claxi_mock_user';

function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'admin';
  return normalized === 'tutor' ? 'tutor' : 'student';
}

function normalizeUserProfile(profile = {}, fallback = {}) {
  const rawRoles = Array.isArray(profile.roles) && profile.roles.length ? profile.roles : [profile.role || fallback.role || 'student'];
  const roles = rawRoles.map((role) => normalizeRole(role));
  const activeRole = normalizeRole(profile.activeRole || profile.role || fallback.role || roles[0] || 'student');

  return {
    ...fallback,
    ...profile,
    roles,
    role: activeRole,
    activeRole,
  };
}

function getFallbackProfile(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    fullName: firebaseUser.displayName,
    displayName: firebaseUser.displayName,
    role: 'student',
  };
}

export function subscribeToAuthChanges(callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      const saved = localStorage.getItem(MOCK_USER_KEY);
      callback(saved ? JSON.parse(saved) : null);
      return;
    }

    const { auth, authModule } = clients;
    unsub = authModule.onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      try {
        await syncStudentGrowth().catch(() => null);
        const profile = (await getUserProfile(firebaseUser.uid)) || getFallbackProfile(firebaseUser);
        callback(normalizeUserProfile({
          ...profile,
          uid: firebaseUser.uid,
          emailVerified: Boolean(firebaseUser.emailVerified),
        }, { uid: firebaseUser.uid }));
      } catch (error) {
        console.warn('Failed to load Firestore profile during auth state change. Falling back to auth profile.', error);
        callback(normalizeUserProfile(getFallbackProfile(firebaseUser), getFallbackProfile(firebaseUser)));
      }
    });
  });

  return () => unsub();
}

export async function loginWithEmail({ email, password }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: email.split('@')[0],
      displayName: email.split('@')[0],
      role: 'student',
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    return normalizeUserProfile(mockUser, mockUser);
  }

  const { auth, authModule } = clients;
  const credential = await authModule.signInWithEmailAndPassword(auth, email, password);
  await syncStudentGrowth().catch(() => null);

  let profile = null;
  try {
    profile = await getUserProfile(credential.user.uid);
  } catch (error) {
    console.warn('Failed to load Firestore profile after login. Falling back to auth identity.', error);
  }

  return normalizeUserProfile({
    uid: credential.user.uid,
    email: credential.user.email,
    fullName: profile?.fullName || profile?.displayName || credential.user.displayName,
    displayName: profile?.displayName || credential.user.displayName,
    role: profile?.role || 'student',
    ...profile,
  });
}

export async function signupWithEmail({ name, email, password, role, referralCode = '' }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: name,
      displayName: name,
      role,
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    return normalizeUserProfile(mockUser, mockUser);
  }

  const { auth, authModule } = clients;
  const credential = await authModule.createUserWithEmailAndPassword(auth, email, password);
  await authModule.updateProfile(credential.user, { displayName: name });

  let profile;
  try {
    profile = await upsertUserProfile({
      uid: credential.user.uid,
      email,
      displayName: name,
      role,
      pendingReferralCode: String(referralCode || '').trim().toUpperCase() || null,
    });
  } catch (error) {
    console.warn('Failed to create Firestore profile during signup. Falling back to auth user.', error);
    profile = {
      uid: credential.user.uid,
      email,
      fullName: name,
      displayName: name,
      role,
    };
  }

  await queueEmailEvent(EMAIL_EVENT_TYPES.WELCOME, {
    userId: credential.user.uid,
    email,
    fullName: name,
    role,
  });

  await syncStudentGrowth().catch(() => null);

  return normalizeUserProfile({
    uid: credential.user.uid,
    email,
    fullName: profile.fullName,
    displayName: profile.displayName,
    role: profile.role,
    ...profile,
  });
}

export async function logoutUser() {
  const clients = await getFirebaseClients();

  if (!clients) {
    localStorage.removeItem(MOCK_USER_KEY);
    return;
  }

  await clients.authModule.signOut(clients.auth);
}

export async function deleteAccount(user) {
  const clients = await getFirebaseClients();

  if (!clients) {
    localStorage.removeItem(MOCK_USER_KEY);
    localStorage.removeItem('claxi_mock_requests');
    localStorage.removeItem('claxi_mock_sessions');
    localStorage.removeItem('claxi_mock_notifications');
    return;
  }

  const authUser = clients.auth.currentUser;
  if (!authUser) {
    throw new Error('No active user session found.');
  }

  await deleteUserProfile(user.uid);
  await clients.authModule.deleteUser(authUser);
}
