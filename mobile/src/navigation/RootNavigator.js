import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BackHandler, Linking, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/ui/States';
import { SessionRatingPrompt } from '../components/student/SessionRatingPrompt';
import { useAuth } from '../context/AuthContext';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { DashboardScreen } from '../screens/student/DashboardScreen';
import { NotificationsScreen } from '../screens/student/NotificationsScreen';
import { OnboardingScreen } from '../screens/student/OnboardingScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { RequestDetailsScreen } from '../screens/student/RequestDetailsScreen';
import { RequestStatusScreen } from '../screens/student/RequestStatusScreen';
import { RequestsScreen } from '../screens/student/RequestsScreen';
import { SessionRoomScreen } from '../screens/student/SessionRoomScreen';
import { SessionScreen } from '../screens/student/SessionScreen';
import { SessionsScreen } from '../screens/student/SessionsScreen';
import { WalletScreen } from '../screens/student/WalletScreen';
import { ActiveSessionScreen } from '../screens/student/ActiveSessionScreen';
import { SessionSummaryScreen } from '../screens/student/SessionSummaryScreen';
import { NotificationsButton } from '../components/navigation/NotificationsButton';
import { StudentBottomNavigation } from '../components/navigation/StudentBottomNavigation';
import { StudentRequestActions } from '../components/student/StudentRequestActions';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/notificationService';
import { subscribeToStudentSessions } from '../services/sessionService';
import { subscribeToStudentRequests } from '../services/classRequestService';
import { colors } from '../theme/colors';
import { RATABLE_SESSION_STATUSES } from '../utils/sessionStatus';
import { getStudentOnboardingStatus } from '../utils/onboarding';

const ACTIVE_REQUEST_REHYDRATION_STATUSES = [
  'pending',
  'matching',
  'offered',
  'accepted',
  'tutor_accepted',
  'tutor_assigned',
  'traveling',
  'travelling',
  'in_transit',
  'arrived',
  'waiting_student',
  'preparing_for_lesson',
];

const ACTIVE_SESSION_REHYDRATION_STATUSES = [
  'in_session',
  'in_progress',
  'ending_requested',
];

const TRACKING_SESSION_REHYDRATION_STATUSES = [
  'accepted',
  'tutor_accepted',
  'tutor_assigned',
  'traveling',
  'travelling',
  'in_transit',
  'arrived',
  'waiting_student',
  'preparing_for_lesson',
];

const REQUEST_FLOW_ROUTES = new Set([
  'RequestStatus', 'RequestDetails', 'SessionRoom', 'SessionScreen', 'Session', 'ActiveSession',
]);

const authScreens = {
  ForgotPassword: ForgotPasswordScreen,
  Login: LoginScreen,
  Signup: SignupScreen,
};

const studentTabs = [
  { key: 'Dashboard', label: 'Home', component: DashboardScreen },
  { key: 'Requests', label: 'My Classes', component: RequestsScreen },
  { key: 'Sessions', label: 'Sessions', component: SessionsScreen },
  { key: 'Wallet', label: 'Payment', component: WalletScreen },
  { key: 'Profile', label: 'Profile', component: ProfileScreen },
  { key: 'Onboarding', label: 'Complete Profile', component: OnboardingScreen },
];

const detailScreens = {
  Notifications: NotificationsScreen,
  RequestStatus: RequestStatusScreen,
  RequestDetails: RequestDetailsScreen,
  SessionRoom: SessionRoomScreen,
  SessionScreen: SessionScreen,
  Session: SessionScreen,
  ActiveSession: ActiveSessionScreen,
  SessionSummary: SessionSummaryScreen,
};

const screenTitles = {
  Dashboard: 'Home',
  Requests: 'My Classes',
  Sessions: 'Sessions',
  Wallet: 'Payment',
  Profile: 'Profile',
  Onboarding: 'Complete Profile',
  Notifications: 'Notifications',
  RequestStatus: 'Class Status',
  RequestDetails: 'Class Details',
  SessionRoom: 'Class Room',
  SessionScreen: 'Session',
  Session: 'Session',
  ActiveSession: 'Active Lesson',
  SessionSummary: 'Lesson Summary',
};

function getScreenTitle(routeKey, fallbackLabel = 'Home') {
  return screenTitles[routeKey] || fallbackLabel;
}

function resolveDeepLink(url) {
  if (!url) {
    return null;
  }

  const cleaned = String(url || '').replace(/^[a-z]+:\/\//i, '');
  const parts = cleaned.split('/').filter(Boolean);
  const host = String(parts[0] || '').toLowerCase();
  const firstPathSegment = parts[1] || '';

  if (host === 'request' && firstPathSegment) {
    return { key: 'RequestStatus', params: { requestId: firstPathSegment, parentTab: 'Requests' } };
  }

  if (host === 'request-details' && firstPathSegment) {
    return { key: 'RequestDetails', params: { requestId: firstPathSegment, parentTab: 'Requests' } };
  }

  if (host === 'session' && firstPathSegment) {
    return { key: 'SessionScreen', params: { requestId: firstPathSegment, parentTab: 'Dashboard' } };
  }

  if ((host === 'active-session' || host === 'active_session') && firstPathSegment) {
    return { key: 'ActiveSession', params: { sessionId: firstPathSegment, parentTab: 'Sessions' } };
  }

  if ((host === 'session-summary' || host === 'session_summary') && firstPathSegment) {
    return { key: 'SessionSummary', params: { sessionId: firstPathSegment, parentTab: 'Sessions' } };
  }

  return null;
}

function getParentTab(routeKey, params) {
  if (params?.parentTab) {
    return params.parentTab;
  }

  if (routeKey === 'RequestStatus' || routeKey === 'RequestDetails') {
    return 'Requests';
  }

  if (routeKey === 'SessionRoom' || routeKey === 'ActiveSession' || routeKey === 'SessionSummary') {
    return 'Sessions';
  }

  if (routeKey === 'SessionScreen' || routeKey === 'Session') {
    return 'Dashboard';
  }

  return routeKey;
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function isTrackingSessionStatus(status) {
  return TRACKING_SESSION_REHYDRATION_STATUSES.includes(normalizeStatus(status));
}

function isActiveSessionStatus(status) {
  return ACTIVE_SESSION_REHYDRATION_STATUSES.includes(normalizeStatus(status));
}

function getRequestIdForSession(session = {}, fallbackId = '') {
  return session?.requestId || session?.activeRequestId || fallbackId || session?.id || '';
}

function buildTrackingSessionRoute(session = {}, fallbackId = '') {
  const requestId = getRequestIdForSession(session, fallbackId);
  return {
    key: 'SessionScreen',
    params: {
      requestId,
      activeRequestId: requestId,
      request: session,
      subject: session?.subject || 'Lesson',
      topic: session?.topic || '',
      parentTab: 'Dashboard',
    },
  };
}

function resolveSessionRoute(session = {}, fallbackSessionId = '') {
  const status = normalizeStatus(session?.status);
  const sessionId = session?.id || fallbackSessionId;

  if (isActiveSessionStatus(status)) {
    return {
      key: 'ActiveSession',
      params: {
        sessionId,
        requestId: getRequestIdForSession(session, sessionId),
        session,
        parentTab: 'Dashboard',
      },
    };
  }

  if (isTrackingSessionStatus(status)) {
    return buildTrackingSessionRoute(session, sessionId);
  }

  return sessionId
    ? { key: 'SessionRoom', params: { sessionId, parentTab: 'Sessions' } }
    : { key: 'Sessions', params: {} };
}

function getRouteIdentity(route = {}) {
  const params = route.params || {};
  const request = params.request || params.session || {};
  const primaryId = params.sessionId || params.requestId || params.activeRequestId || request?.id || '';
  const status = request?.status ? normalizeStatus(request.status) : '';
  const draftSignature = params.isNewRequest
    ? [params.subject || '', params.topic || '', params.durationMinutes || '', params.estimatedMinutes || ''].join(':')
    : '';
  return [route.key || 'Dashboard', primaryId, status, draftSignature].join('|');
}

function resolveNotificationRoute(notification = {}, context = {}) {
  const targetPath = String(notification?.targetPath || '').trim();
  const type = String(notification?.type || '').toLowerCase();
  const requestId = notification?.requestId || '';
  const sessionId = notification?.sessionId || '';
  const sessions = Array.isArray(context.sessions) ? context.sessions : [];
  const session = sessions.find((item) => {
    const itemId = String(item?.id || '');
    const itemRequestId = String(item?.requestId || item?.activeRequestId || '');
    return (sessionId && itemId === String(sessionId)) || (requestId && itemRequestId === String(requestId));
  });

  if (['lesson_completed', 'session_completed', 'session_canceled', 'lesson_canceled'].includes(type)) {
    if (sessionId) {
      return { key: 'SessionSummary', params: { sessionId, parentTab: 'Sessions' } };
    }
  }

  if (['tutor_arrived', 'session_started', 'lesson_started'].includes(type)) {
    if (session) {
      return resolveSessionRoute(session, sessionId);
    }
    if (sessionId) {
      return { key: 'ActiveSession', params: { sessionId, parentTab: 'Dashboard' } };
    }
  }

  if (targetPath.startsWith('/app/session/')) {
    const targetSessionId = targetPath.split('/app/session/')[1] || sessionId;
    if (session) {
      return resolveSessionRoute(session, targetSessionId);
    }
    if (['request_accepted', 'lesson_accepted', 'tutor_accepted', 'tutor_assigned'].includes(type) || requestId) {
      return buildTrackingSessionRoute({ id: targetSessionId, requestId, status: 'accepted' }, requestId || targetSessionId);
    }
    return targetSessionId
      ? { key: 'SessionRoom', params: { sessionId: targetSessionId, parentTab: 'Sessions' } }
      : { key: 'Sessions', params: {} };
  }

  if (targetPath.includes('/student/payment') || type.includes('payment')) {
    return { key: 'Wallet', params: {} };
  }

  if (targetPath.includes('/student/requests') || type === 'lesson_completed' || type === 'session_completed') {
    return requestId
      ? { key: 'RequestStatus', params: { requestId, parentTab: 'Requests' } }
      : { key: 'Requests', params: {} };
  }

  if (sessionId) {
    if (session) {
      return resolveSessionRoute(session, sessionId);
    }
    return { key: 'ActiveSession', params: { sessionId, parentTab: 'Dashboard' } };
  }

  if (requestId) {
    return { key: 'RequestStatus', params: { requestId, parentTab: 'Requests' } };
  }

  return { key: 'Dashboard', params: {} };
}

export function RootNavigator() {
  const { initializing, user } = useAuth();
  const [authRoute, setAuthRoute] = useState('Login');
  const [, setAuthHistory] = useState([]);
  const [activeRoute, setActiveRoute] = useState({ key: 'Dashboard', params: {} });
  const [history, setHistory] = useState([]);
  const authHistoryRef = useRef([]);
  const authRouteRef = useRef('Login');
  const historyRef = useRef([]);
  const activeRouteRef = useRef({ key: 'Dashboard', params: {} });

  useEffect(() => {
    authRouteRef.current = authRoute;
  }, [authRoute]);

  useEffect(() => {
    activeRouteRef.current = activeRoute;
  }, [activeRoute]);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [ratingQueue, setRatingQueue] = useState([]);
  const [handledRatingSessionIds, setHandledRatingSessionIds] = useState([]);
  const previousSessionStatusesRef = useRef(new Map());
  const hasRehydratedActiveStateRef = useRef(false);
  const ratingTarget = useMemo(() => {
    if (!ratingQueue.length) return null;
    const [nextSessionId] = ratingQueue;
    return sessions.find((session) => session.id === nextSessionId) || null;
  }, [ratingQueue, sessions]);
  const onboardingStatus = useMemo(() => getStudentOnboardingStatus(user), [user]);

  useEffect(() => {
    let mounted = true;

    Linking.getInitialURL().then((url) => {
      if (!mounted) {
        return;
      }

      const route = resolveDeepLink(url);
      if (route) {
        setActiveRoute(route);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const route = resolveDeepLink(url);
      if (route) {
        setActiveRoute(route);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setAuthRoute('Login');
      authHistoryRef.current = [];
      setAuthHistory([]);
      historyRef.current = [];
      setHistory([]);
      setActiveRoute({ key: 'Dashboard', params: {} });
      setNotifications([]);
      setSessions([]);
      setRequests([]);
      setRatingQueue([]);
      setHandledRatingSessionIds([]);
      previousSessionStatusesRef.current = new Map();
      hasRehydratedActiveStateRef.current = false;
      setNotificationsLoading(false);
      return () => {};
    }

    return subscribeToNotifications(
      user.uid,
      (items) => {
        setNotifications(items);
        setNotificationsLoading(false);
      },
      () => {
        setNotifications([]);
        setNotificationsLoading(false);
      },
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setSessions([]);
      setRatingQueue([]);
      setHandledRatingSessionIds([]);
      previousSessionStatusesRef.current = new Map();
      return () => {};
    }

    return subscribeToStudentSessions(
      user.uid,
      (items) => setSessions(items),
      () => setSessions([]),
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setRequests([]);
      return () => {};
    }

    return subscribeToStudentRequests(
      user.uid,
      (items) => setRequests(Array.isArray(items) ? items : []),
      () => setRequests([]),
    );
  }, [user?.uid]);

  // BUG-003: Rehydrate active ongoing request or active session on launch / auth ready
  useEffect(() => {
    if (!user?.uid) return;
    if (hasRehydratedActiveStateRef.current) return;
    if (!onboardingStatus.complete) return;

    // Only auto-rehydrate if user is currently on the initial launch screen (Dashboard)
    if (activeRoute.key !== 'Dashboard') return;

    // 1. Check for active ongoing session
    const activeSession = sessions.find((s) => isActiveSessionStatus(s?.status));

    if (activeSession) {
      hasRehydratedActiveStateRef.current = true;
      openRoute(resolveSessionRoute(activeSession, activeSession.id));
      return;
    }

    // 2. Check for accepted/travelling session that belongs on the live tracking screen.
    const trackingSession = sessions.find((s) => isTrackingSessionStatus(s?.status));

    if (trackingSession) {
      hasRehydratedActiveStateRef.current = true;
      openRoute(resolveSessionRoute(trackingSession, trackingSession.id));
      return;
    }

    // 3. Check for active ongoing class request
    const activeRequest = requests.find((r) => {
      const st = normalizeStatus(r?.status);
      return ACTIVE_REQUEST_REHYDRATION_STATUSES.includes(st);
    });

    if (activeRequest) {
      hasRehydratedActiveStateRef.current = true;
      openRoute({
        key: 'Session',
        params: {
          requestId: activeRequest.id,
          activeRequestId: activeRequest.id,
          request: activeRequest,
          subject: activeRequest.subject || 'Lesson',
          topic: activeRequest.topic || '',
          parentTab: 'Dashboard',
        },
      });
    }
  }, [activeRoute.key, onboardingStatus.complete, requests, sessions, user?.uid]);

  // Reset rehydration flag once active session/request completes or cancels
  useEffect(() => {
    if (!user?.uid) return;
    const hasActiveSession = sessions.some((s) =>
      isActiveSessionStatus(s?.status) || isTrackingSessionStatus(s?.status)
    );
    const hasActiveRequest = requests.some((r) =>
      ACTIVE_REQUEST_REHYDRATION_STATUSES.includes(normalizeStatus(r?.status))
    );
    if (!hasActiveSession && !hasActiveRequest) {
      hasRehydratedActiveStateRef.current = false;
    }
  }, [requests, sessions, user?.uid]);

  // Reactive Auto-Navigation on Live Status Changes:
  // 1) Lesson starts (in_session, in_progress): auto-navigate to ActiveSession
  // 2) Tutor arrives or prepares (arrived, waiting_student, preparing_for_lesson): auto-navigate to SessionScreen
  useEffect(() => {
    if (!user?.uid || !onboardingStatus.complete) return;

    // 1. Check for active lesson in progress (in_session, in_progress, ending_requested)
    const activeLessonSession = sessions.find((s) => isActiveSessionStatus(s?.status));
    const activeLessonRequest = requests.find((r) =>
      ['in_session', 'in_progress', 'ending_requested'].includes(normalizeStatus(r?.status))
    );

    if (activeLessonSession || activeLessonRequest) {
      if (activeRoute.key !== 'ActiveSession' && activeRoute.key !== 'SessionSummary') {
        const effSessionId = activeLessonSession?.id
          || activeLessonRequest?.sessionId
          || activeLessonRequest?.id;
        const effRequestId = activeLessonSession?.requestId
          || activeLessonRequest?.id
          || effSessionId;

        openRoute({
          key: 'ActiveSession',
          params: {
            sessionId: effSessionId,
            requestId: effRequestId,
            session: activeLessonSession || activeLessonRequest,
            request: activeLessonRequest || activeLessonSession,
            parentTab: 'Dashboard',
          },
        });
      }
      return;
    }

    // 2. Check for tutor arrived / waiting / preparing
    const arrivedSession = sessions.find((s) =>
      ['arrived', 'waiting_student', 'preparing_for_lesson'].includes(normalizeStatus(s?.status))
    );
    const arrivedRequest = requests.find((r) =>
      ['arrived', 'waiting_student', 'preparing_for_lesson'].includes(normalizeStatus(r?.status))
    );

    if (arrivedSession || arrivedRequest) {
      if (
        activeRoute.key !== 'SessionScreen' &&
        activeRoute.key !== 'Session' &&
        activeRoute.key !== 'ActiveSession' &&
        activeRoute.key !== 'SessionSummary'
      ) {
        const target = arrivedRequest || arrivedSession;
        const effRequestId = target?.id || target?.requestId || target?.activeRequestId;
        openRoute({
          key: 'SessionScreen',
          params: {
            requestId: effRequestId,
            activeRequestId: effRequestId,
            request: target,
            subject: target?.subject || 'Lesson',
            topic: target?.topic || '',
            parentTab: 'Dashboard',
          },
        });
      }
    }
  }, [activeRoute.key, onboardingStatus.complete, requests, sessions, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (onboardingStatus.complete) return;
    if (activeRoute.key === 'Onboarding') return;
    setActiveRoute({ key: 'Onboarding', params: {} });
  }, [activeRoute.key, onboardingStatus.complete, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const previousStatuses = previousSessionStatusesRef.current;
    const currentStatuses = new Map();
    const transitionedSessionIds = [];

    sessions.forEach((session) => {
      const sessionId = String(session?.id || '').trim();
      if (!sessionId) return;

      const currentStatus = String(session?.status || '').toLowerCase();
      const previousStatus = previousStatuses.get(sessionId);
      currentStatuses.set(sessionId, currentStatus);

      if (!previousStatus) return;
      if (previousStatus === currentStatus) return;
      if (RATABLE_SESSION_STATUSES.includes(previousStatus)) return;
      if (!RATABLE_SESSION_STATUSES.includes(currentStatus)) return;
      if (handledRatingSessionIds.includes(sessionId)) return;

      transitionedSessionIds.push(sessionId);
    });

    previousSessionStatusesRef.current = currentStatuses;

    if (!transitionedSessionIds.length) return;
    setRatingQueue((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      transitionedSessionIds.forEach((sessionId) => {
        if (!seen.has(sessionId)) {
          next.push(sessionId);
          seen.add(sessionId);
        }
      });
      return next;
    });
  }, [handledRatingSessionIds, sessions, user?.uid]);

  const openAuthRoute = (target) => {
    const nextRoute = typeof target === 'string' ? target : target?.key || 'Login';
    const currentRoute = authRouteRef.current;
    if (nextRoute === currentRoute) {
      return;
    }

    const nextHistory = [...authHistoryRef.current, currentRoute];
    authHistoryRef.current = nextHistory;
    setAuthHistory(nextHistory);
    setAuthRoute(nextRoute);
  };

  const goAuthBack = () => {
    if (authHistoryRef.current.length > 0) {
      const nextHistory = [...authHistoryRef.current];
      const previousRoute = nextHistory.pop();
      authHistoryRef.current = nextHistory;
      setAuthHistory(nextHistory);
      setAuthRoute(previousRoute);
      return;
    }

    if (authRouteRef.current !== 'Login') {
      setAuthRoute('Login');
    }
  };

  const openRoute = (target) => {
    const nextRoute =
      typeof target === 'string'
        ? { key: target, params: {} }
        : { key: target?.key || 'Dashboard', params: target?.params || {} };

    const currentRoute = activeRouteRef.current;
    if (getRouteIdentity(nextRoute) === getRouteIdentity(currentRoute)) {
      return;
    }

    if (nextRoute.key === 'Dashboard') {
      historyRef.current = [];
      setHistory([]);
    } else {
      const nextHistory = [...historyRef.current, currentRoute];
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }

    setActiveRoute(nextRoute);
  };

  const goBack = (fallbackKey) => {

    if (historyRef.current.length > 0) {
      const nextHistory = [...historyRef.current];
      const previousRoute = nextHistory.pop();
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setActiveRoute(previousRoute);
      return;
    }

    const currentRoute = activeRouteRef.current;
    const targetFallback =
      currentRoute?.params?.parentTab ||
      fallbackKey ||
      (currentRoute?.key !== 'Dashboard' ? 'Dashboard' : null);

    if (targetFallback && targetFallback !== currentRoute?.key) {
      setActiveRoute({ key: targetFallback, params: {} });
    }
  };

  useEffect(() => {
    const onHardwareBack = () => {
      if (!user?.uid) {
        return goAuthBack();
      }

      if (historyRef.current.length > 0) {
        goBack();
        return true;
      }

      if (activeRoute.key !== 'Dashboard') {
        goBack('Dashboard');
        return true;
      }

      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [activeRoute.key, user?.uid]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        if (historyRef.current.length > 0) {
          goBack();
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const activeTabKey = getParentTab(activeRoute.key, activeRoute.params);
  const active = studentTabs.find((tab) => tab.key === activeTabKey) || studentTabs[0];
  const ActiveScreen = detailScreens[activeRoute.key] || active.component;
  const isFullscreenRoute =
    activeRoute.key === 'SessionRoom' ||
    activeRoute.key === 'SessionScreen' ||
    activeRoute.key === 'Session' ||
    activeRoute.key === 'Dashboard' ||
    activeRoute.key === 'Wallet' ||
    activeRoute.key === 'ActiveSession' ||
    activeRoute.key === 'SessionSummary';
  const showBottomNavigation = onboardingStatus.complete && !REQUEST_FLOW_ROUTES.has(activeRoute.key) && activeRoute.key !== 'Onboarding';
  const ongoingRequest = requests.find((request) =>
    ACTIVE_REQUEST_REHYDRATION_STATUSES.includes(normalizeStatus(request?.status))
  );
  const ongoingActiveSession = sessions.find((session) => isActiveSessionStatus(session?.status));
  const ongoingTrackingSession = sessions.find((session) => isTrackingSessionStatus(session?.status));
  const unreadCount = notifications.filter((item) => !item?.read).length;

  if (initializing) {
    return (
      <View style={styles.safe}>
        <LoadingState label="Restoring session" />
      </View>
    );
  }

  if (!user) {
    const AuthScreen = authScreens[authRoute];
    return (
      <View style={styles.safe}>
        <AuthScreen navigate={openAuthRoute} goBack={goAuthBack} />
      </View>
    );
  }

  return (
    <View style={[styles.safe, isFullscreenRoute ? styles.safeFullscreen : null]}>
      <View style={styles.shell}>
        {isFullscreenRoute ? (
          <View style={[styles.screenContent, showBottomNavigation && activeRoute.key !== 'Dashboard' && styles.screenWithNavigation]}>
            <ActiveScreen
              navigate={openRoute}
              goBack={goBack}
              route={activeRoute}
              unreadCount={unreadCount}
              requests={requests}
              sessions={sessions}
            />
          </View>
        ) : (
          <SafeAreaView style={styles.contentSafe}>
            <View style={styles.universalTopBar}>
              <Pressable
                accessibilityLabel="Back"
                accessibilityRole="button"
                onPress={() => goBack()}
                style={styles.universalBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#0f172a" />
              </Pressable>
              <Text style={styles.universalBarTitle} numberOfLines={1}>
                {getScreenTitle(activeRoute.key, active.label)}
              </Text>
              <NotificationsButton
                navigate={openRoute}
                unreadCount={unreadCount}
              />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              <ActiveScreen
                navigate={openRoute}
                goBack={goBack}
                route={activeRoute}
                notifications={notifications}
                isLoading={notificationsLoading}
                unreadCount={unreadCount}
                requests={requests}
                sessions={sessions}
                onMarkAllRead={() => markAllNotificationsRead(user?.uid).catch(() => null)}
                onOpenNotification={async (notification) => {
                  await markNotificationRead(notification?.id).catch(() => null);
                  openRoute(resolveNotificationRoute(notification, { sessions, requests }));
                }}
              />
            </ScrollView>
          </SafeAreaView>
        )}
        {showBottomNavigation ? (
          <StudentRequestActions
            key={activeRoute.key}
            navigate={openRoute}
            parentTab={activeRoute.key}
            activeRequest={ongoingRequest}
            activeSession={ongoingActiveSession}
            trackingSession={ongoingTrackingSession}
          >
            {(actions) => (
              <StudentBottomNavigation
                currentRoute={activeRoute.key === 'SessionSummary' ? 'Sessions' : activeRoute.key}
                navigate={openRoute}
                {...actions}
              />
            )}
          </StudentRequestActions>
        ) : null}
        {activeRoute.key !== 'SessionSummary' && (
          <SessionRatingPrompt
            session={ratingTarget}
            role="student"
            onHandled={(sessionId) => {
              if (!sessionId) {
                return;
              }
              setHandledRatingSessionIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
              setRatingQueue((prev) => prev.filter((id) => id !== sessionId));
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  universalTopBar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  universalBackButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  universalBarTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 0,
  },
  safeFullscreen: {
    paddingTop: 0,
  },
  shell: {
    flex: 1,
    width: '100%',
  },
  screenContent: { flex: 1 },
  screenWithNavigation: { paddingBottom: Platform.OS === 'ios' ? 112 : 100 },
  contentSafe: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 12 : 0,
  },
  content: {
    paddingBottom: 128,
    padding: 16,
    paddingTop: 12,
  },
});
