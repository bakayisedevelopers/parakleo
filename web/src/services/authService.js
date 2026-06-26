import { getFirebaseClients } from '../firebase/config';
import {
  buildPortalRoleMismatchMessage,
  normalizePortalRole,
  readPendingSignupPortalRole,
  clearPendingSignupPortalRole,
} from '../constants/portal';
import { isEmailAllowlistedAdmin } from '../utils/admin';
import { syncStudentGrowth } from './studentGrowthService';
import { deleteUserProfile, getUserProfile, upsertUserProfile } from './userService';

const MOCK_USER_KEY = 'parakleo_mock_user';
const REMEMBER_ME_KEY = 'parakleo_remember_me';
const LEGACY_REMEMBER_ME_KEY = 'claxi_remember_me';

function getStorage(type) {
  if (typeof window === 'undefined') return null;
  if (type === 'session') return window.sessionStorage;
  return window.localStorage;
}

function readRememberMePreference() {
  const storage = getStorage('local');
  const currentValue = storage?.getItem(REMEMBER_ME_KEY);
  if (currentValue != null) return currentValue === 'true';
  const legacyValue = storage?.getItem(LEGACY_REMEMBER_ME_KEY);
  if (legacyValue != null) {
    storage?.setItem(REMEMBER_ME_KEY, legacyValue);
    return legacyValue === 'true';
  }
  return false;
}

function persistRememberMePreference(rememberMe) {
  const storage = getStorage('local');
  if (!storage) return;
  storage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
}

function clearRememberMePreference() {
  const storage = getStorage('local');
  storage?.removeItem(REMEMBER_ME_KEY);
  storage?.removeItem(LEGACY_REMEMBER_ME_KEY);
}

function getStoredMockUser() {
  const localUser = getStorage('local')?.getItem(MOCK_USER_KEY);
  if (localUser) return JSON.parse(localUser);

  const sessionUser = getStorage('session')?.getItem(MOCK_USER_KEY);
  if (sessionUser) return JSON.parse(sessionUser);

  return null;
}

function persistMockUser(user, rememberMe) {
  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');
  const payload = JSON.stringify(user);

  if (rememberMe) {
    localStorageRef?.setItem(MOCK_USER_KEY, payload);
    sessionStorageRef?.removeItem(MOCK_USER_KEY);
    return;
  }

  sessionStorageRef?.setItem(MOCK_USER_KEY, payload);
  localStorageRef?.removeItem(MOCK_USER_KEY);
}

function clearStoredMockUser() {
  getStorage('local')?.removeItem(MOCK_USER_KEY);
  getStorage('session')?.removeItem(MOCK_USER_KEY);
}

function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'admin';
  return normalized === 'tutor' ? 'tutor' : 'student';
}

function normalizeExpectedRole(role) {
  return normalizePortalRole(role);
}

function normalizeUserProfile(profile = {}, fallback = {}) {
  const rawRoles = Array.isArray(profile.roles) && profile.roles.length ? profile.roles : [profile.role || fallback.role || 'student'];
  const roles = rawRoles.map((role) => normalizeRole(role));
  const isAdminAccount = isEmailAllowlistedAdmin(profile.email) || profile.isAdmin === true || roles.includes('admin');
  const activeRole = isAdminAccount
    ? 'admin'
    : normalizeRole(profile.activeRole || profile.role || fallback.role || roles[0] || 'student');

  return {
    ...fallback,
    ...profile,
    roles: isAdminAccount ? Array.from(new Set([...roles, 'admin'])) : roles,
    role: activeRole,
    activeRole,
    isAdmin: isAdminAccount || profile.isAdmin === true,
  };
}

function getFallbackProfile(firebaseUser) {
  const pendingSignupRole = readPendingSignupPortalRole();
  const fallbackRole = pendingSignupRole || 'student';
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    fullName: firebaseUser.displayName,
    displayName: firebaseUser.displayName,
    role: fallbackRole,
  };
}

export function subscribeToAuthChanges(callback) {
  let unsub = () => {};

  getFirebaseClients().then((clients) => {
    if (!clients) {
      callback(getStoredMockUser());
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
        if (profile?.role !== 'student' || readPendingSignupPortalRole()) {
          clearPendingSignupPortalRole();
        }
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

export async function loginWithEmail({ email, password, expectedRole } = {}) {
  const rememberMe = readRememberMePreference();
  const clients = await getFirebaseClients();
  const normalizedExpectedRole = expectedRole ? normalizeExpectedRole(expectedRole) : '';
  clearPendingSignupPortalRole();

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: email.split('@')[0],
      displayName: email.split('@')[0],
      role: 'student',
    };
    if (normalizedExpectedRole && normalizeRole(mockUser.role) !== normalizedExpectedRole) {
      clearStoredMockUser();
      throw new Error(buildPortalRoleMismatchMessage(normalizedExpectedRole, mockUser.role));
    }
    persistMockUser(mockUser, rememberMe);
    return normalizeUserProfile(mockUser, mockUser);
  }

  const { auth, authModule } = clients;
  const persistence = rememberMe
    ? authModule.browserLocalPersistence
    : authModule.browserSessionPersistence;
  await authModule.setPersistence(auth, persistence);
  const credential = await authModule.signInWithEmailAndPassword(auth, email, password);
  await syncStudentGrowth().catch(() => null);

  let profile = null;
  try {
    profile = await getUserProfile(credential.user.uid);
  } catch (error) {
    console.warn('Failed to load Firestore profile after login. Falling back to auth identity.', error);
  }

  const normalizedUser = normalizeUserProfile({
    uid: credential.user.uid,
    email: credential.user.email,
    fullName: profile?.fullName || profile?.displayName || credential.user.displayName,
    displayName: profile?.displayName || credential.user.displayName,
    role: profile?.role || 'student',
    ...profile,
  });

  if (normalizedExpectedRole && normalizeRole(normalizedUser.role) !== normalizedExpectedRole) {
    await clients.authModule.signOut(clients.auth).catch(() => null);
    clearStoredMockUser();
    throw new Error(buildPortalRoleMismatchMessage(normalizedExpectedRole, normalizedUser.role));
  }

  return normalizedUser;
}

export function setRememberMePreference(rememberMe) {
  persistRememberMePreference(Boolean(rememberMe));
}

export function getRememberMePreference() {
  return readRememberMePreference();
}

export async function signupWithEmail({ name, email, password, role, referralSlug = '', expectedRole } = {}) {
  const clients = await getFirebaseClients();
  const normalizedExpectedRole = expectedRole ? normalizeExpectedRole(expectedRole) : '';
  const normalizedRole = normalizeRole(expectedRole || role);

  if (normalizedRole === 'admin') {
    throw new Error('Admin accounts are provisioned centrally and cannot be created from this portal.');
  }

  if (!clients) {
    const mockUser = {
      uid: 'mock-user',
      email,
      fullName: name,
      displayName: name,
      role: normalizedRole,
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
      role: normalizedRole,
      pendingReferralSlug: String(referralSlug || '').trim().toLowerCase() || null,
    });
  } catch (error) {
    console.warn('Failed to create Firestore profile during signup. Falling back to auth user.', error);
    profile = {
      uid: credential.user.uid,
      email,
      fullName: name,
      displayName: name,
      role: normalizedRole,
    };
  }

  await syncStudentGrowth().catch(() => null);

  const normalizedUser = normalizeUserProfile({
    uid: credential.user.uid,
    email,
    fullName: profile.fullName,
    displayName: profile.displayName,
    role: profile.role,
    ...profile,
  });

  if (normalizedExpectedRole && normalizeRole(normalizedUser.role) !== normalizedExpectedRole) {
    await clients.authModule.signOut(clients.auth).catch(() => null);
    throw new Error(buildPortalRoleMismatchMessage(normalizedExpectedRole, normalizedUser.role));
  }

  return normalizedUser;
}

export async function logoutUser() {
  const clients = await getFirebaseClients();

  if (!clients) {
    clearStoredMockUser();
    clearRememberMePreference();
    return;
  }

  await clients.authModule.signOut(clients.auth);
  clearRememberMePreference();
}

export async function deleteAccount(user) {
  const clients = await getFirebaseClients();

  if (!clients) {
    clearStoredMockUser();
    clearRememberMePreference();
    localStorage.removeItem('parakleo_mock_requests');
    localStorage.removeItem('parakleo_mock_sessions');
    localStorage.removeItem('parakleo_mock_notifications');
    return;
  }

  const authUser = clients.auth.currentUser;
  if (!authUser) {
    throw new Error('No active user session found.');
  }

  await deleteUserProfile(user.uid);
  await clients.authModule.deleteUser(authUser);
  clearRememberMePreference();
}
