const PORTAL_STORAGE_KEY = 'parakleo_active_portal';
const PENDING_SIGNUP_ROLE_KEY = 'parakleo_pending_signup_role';

const PORTAL_LABELS = {
  student: 'Student',
  tutor: 'Tutor',
  admin: 'Admin',
};

const PORTAL_ROUTES = {
  student: {
    landingPath: '/',
    loginPath: '/login',
    signupPath: '/signup',
    dashboardPath: '/app/student',
    canSignUp: true,
  },
  tutor: {
    landingPath: '/tutor',
    loginPath: '/login',
    signupPath: '/signup',
    dashboardPath: '/app/tutor',
    canSignUp: true,
  },
  admin: {
    landingPath: '/admin',
    loginPath: '/login',
    signupPath: '/signup',
    dashboardPath: '/app/admin',
    canSignUp: false,
  },
};

const SHARED_APP_PATHS = ['/app/profile', '/app/notifications', '/app/onboarding', '/app/session/'];

function hasWindow() {
  return typeof window !== 'undefined';
}

export function normalizePortalRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'tutor') return 'tutor';
  return 'student';
}

export function getPortalLabel(role) {
  return PORTAL_LABELS[normalizePortalRole(role)] || PORTAL_LABELS.student;
}

export function getPortalRoutes(role) {
  return PORTAL_ROUTES[normalizePortalRole(role)] || PORTAL_ROUTES.student;
}

export function getPortalRoleFromHostname(hostname = '') {
  const normalizedHostname = String(hostname).toLowerCase();
  if (normalizedHostname.includes('admin')) return 'admin';
  if (normalizedHostname.includes('tutor')) return 'tutor';
  return '';
}

export function getPortalRoleFromPath(pathname = '') {
  const normalizedPath = String(pathname).toLowerCase();
  if (normalizedPath.startsWith('/admin')) return 'admin';
  if (normalizedPath.startsWith('/tutor')) return 'tutor';
  return '';
}

export function readStoredPortalRole() {
  if (!hasWindow()) return '';

  try {
    return normalizePortalRole(window.localStorage.getItem(PORTAL_STORAGE_KEY));
  } catch (_error) {
    return '';
  }
}

export function persistPortalRole(role) {
  if (!hasWindow()) return;

  try {
    window.localStorage.setItem(PORTAL_STORAGE_KEY, normalizePortalRole(role));
  } catch (_error) {
    // Ignore storage failures and fall back to hostname detection.
  }
}

export function setPendingSignupPortalRole(role) {
  if (!hasWindow()) return;

  try {
    window.sessionStorage.setItem(PENDING_SIGNUP_ROLE_KEY, normalizePortalRole(role));
  } catch (_error) {
    // Ignore storage failures.
  }
}

export function readPendingSignupPortalRole() {
  if (!hasWindow()) return '';

  try {
    return normalizePortalRole(window.sessionStorage.getItem(PENDING_SIGNUP_ROLE_KEY));
  } catch (_error) {
    return '';
  }
}

export function clearPendingSignupPortalRole() {
  if (!hasWindow()) return;

  try {
    window.sessionStorage.removeItem(PENDING_SIGNUP_ROLE_KEY);
  } catch (_error) {
    // Ignore storage failures.
  }
}

export function resolvePortalRole({ hostname = '', pathname = '', storedRole = '' } = {}) {
  const hostRole = getPortalRoleFromHostname(hostname);
  if (hostRole) return hostRole;

  const pathRole = getPortalRoleFromPath(pathname);
  if (pathRole) return pathRole;

  const normalizedStoredRole = normalizePortalRole(storedRole);
  if (normalizedStoredRole) return normalizedStoredRole;

  return 'student';
}

export function getPortalContext(options = {}) {
  const role = resolvePortalRole(options);
  return {
    role,
    label: getPortalLabel(role),
    routes: getPortalRoutes(role),
    canSignUp: getPortalRoutes(role).canSignUp,
  };
}

export function isSharedAppPath(pathname = '') {
  const normalizedPath = String(pathname || '').toLowerCase();
  return normalizedPath === '/app'
    || SHARED_APP_PATHS.some((path) => normalizedPath === path || normalizedPath.startsWith(path));
}

export function isPathAllowedForPortal(pathname = '', role = 'student') {
  const normalizedPath = String(pathname || '').toLowerCase();
  const normalizedRole = normalizePortalRole(role);

  if (!normalizedPath.startsWith('/app')) return true;
  if (isSharedAppPath(normalizedPath)) return true;

  if (normalizedRole === 'admin') return normalizedPath.startsWith('/app/admin');
  if (normalizedRole === 'tutor') return normalizedPath.startsWith('/app/tutor');
  return normalizedPath.startsWith('/app/student');
}

export function resolvePostAuthPath({ fromPath, portalRole, activeRole } = {}) {
  const normalizedPortalRole = normalizePortalRole(portalRole);
  const normalizedActiveRole = normalizePortalRole(activeRole || normalizedPortalRole);
  const requestedPath = String(fromPath || '').trim();

  if (requestedPath && isPathAllowedForPortal(requestedPath, normalizedPortalRole)) {
    return requestedPath;
  }

  return getPortalRoutes(normalizedActiveRole).dashboardPath;
}

export function buildPortalRoleMismatchMessage(expectedRole, actualRole) {
  const expectedLabel = getPortalLabel(expectedRole);
  const actualLabel = getPortalLabel(actualRole);
  return `This portal accepts ${expectedLabel.toLowerCase()} accounts only. Please use the ${actualLabel.toLowerCase()} portal.`;
}
