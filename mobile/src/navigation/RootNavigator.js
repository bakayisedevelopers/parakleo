import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/ui/States';
import { SessionRatingPrompt } from '../components/student/SessionRatingPrompt';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/auth/HomeScreen';
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
import { SessionsScreen } from '../screens/student/SessionsScreen';
import { WalletScreen } from '../screens/student/WalletScreen';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/notificationService';
import { subscribeToStudentSessions } from '../services/sessionService';
import { colors } from '../theme/colors';
import { RATABLE_SESSION_STATUSES } from '../utils/sessionStatus';

const authScreens = {
  Home: HomeScreen,
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
};

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
    return { key: 'SessionRoom', params: { sessionId: firstPathSegment, parentTab: 'Sessions' } };
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

  if (routeKey === 'SessionRoom') {
    return 'Sessions';
  }

  return routeKey;
}

function resolveNotificationRoute(notification = {}) {
  const targetPath = String(notification?.targetPath || '').trim();
  const type = String(notification?.type || '').toLowerCase();
  const requestId = notification?.requestId || '';
  const sessionId = notification?.sessionId || '';

  if (targetPath.startsWith('/app/session/')) {
    const targetSessionId = targetPath.split('/app/session/')[1] || sessionId;
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
    return { key: 'SessionRoom', params: { sessionId, parentTab: 'Sessions' } };
  }

  if (requestId) {
    return { key: 'RequestStatus', params: { requestId, parentTab: 'Requests' } };
  }

  return { key: 'Dashboard', params: {} };
}

export function RootNavigator() {
  const { initializing, logout, user } = useAuth();
  const [authRoute, setAuthRoute] = useState('Home');
  const [activeRoute, setActiveRoute] = useState({ key: 'Dashboard', params: {} });
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [ratingQueue, setRatingQueue] = useState([]);
  const [handledRatingSessionIds, setHandledRatingSessionIds] = useState([]);
  const previousSessionStatusesRef = useRef(new Map());
  const ratingTarget = useMemo(() => {
    if (!ratingQueue.length) return null;
    const [nextSessionId] = ratingQueue;
    return sessions.find((session) => session.id === nextSessionId) || null;
  }, [ratingQueue, sessions]);

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
      setAuthRoute('Home');
      setActiveRoute({ key: 'Dashboard', params: {} });
      setIsNavOpen(false);
      setNotifications([]);
      setSessions([]);
      setRatingQueue([]);
      setHandledRatingSessionIds([]);
      previousSessionStatusesRef.current = new Map();
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

  useEffect(() => {
    if (!ratingQueue.length) return;
    const activeSessionIds = new Set(sessions.map((session) => session.id));
    setRatingQueue((prev) => prev.filter((sessionId) => activeSessionIds.has(sessionId)));
  }, [ratingQueue.length, sessions]);

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
        <AuthScreen navigate={setAuthRoute} />
      </View>
    );
  }

  const openRoute = (target) => {
    if (typeof target === 'string') {
      setActiveRoute({ key: target, params: {} });
    } else if (target?.key) {
      setActiveRoute({ key: target.key, params: target.params || {} });
    }

    setIsNavOpen(false);
  };

  const goBack = (fallbackKey = 'Dashboard') => {
    openRoute(activeRoute?.params?.parentTab || fallbackKey);
  };

  const activeTabKey = getParentTab(activeRoute.key, activeRoute.params);
  const active = studentTabs.find((tab) => tab.key === activeTabKey) || studentTabs[0];
  const ActiveScreen = detailScreens[activeRoute.key] || active.component;
  const isFullscreenRoute = activeRoute.key === 'SessionRoom';
  const unreadCount = notifications.filter((item) => !item?.read).length;

  const handleLogout = async () => {
    setAuthRoute('Home');
    setIsNavOpen(false);
    setActiveRoute({ key: 'Dashboard', params: {} });
    setSessions([]);
    setRatingQueue([]);
    setHandledRatingSessionIds([]);
    previousSessionStatusesRef.current = new Map();
    await logout();
  };

  return (
    <View style={[styles.safe, isFullscreenRoute ? styles.safeFullscreen : null]}>
      <View style={styles.shell}>
        {isFullscreenRoute ? (
          <ActiveScreen navigate={openRoute} goBack={goBack} route={activeRoute} />
        ) : (
          <SafeAreaView style={styles.contentSafe}>
            <ScrollView contentContainerStyle={styles.content}>
              <ActiveScreen
                navigate={openRoute}
                goBack={goBack}
                route={activeRoute}
                notifications={notifications}
                isLoading={notificationsLoading}
                unreadCount={unreadCount}
                onMarkAllRead={() => markAllNotificationsRead(user?.uid).catch(() => null)}
                onOpenNotification={async (notification) => {
                  await markNotificationRead(notification?.id).catch(() => null);
                  openRoute(resolveNotificationRoute(notification));
                }}
              />
            </ScrollView>
          </SafeAreaView>
        )}
        {!isFullscreenRoute ? (
          <View style={styles.bottomNav}>
            <Pressable accessibilityRole="button" onPress={() => openRoute('Requests')} style={[styles.bottomNavItem, activeTabKey === 'Requests' && styles.bottomNavItemActive]}>
              <Ionicons name={activeTabKey === 'Requests' ? 'book' : 'book-outline'} size={22} color={activeTabKey === 'Requests' ? colors.brand : '#3f3f46'} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openRoute('Wallet')} style={[styles.bottomNavItem, activeTabKey === 'Wallet' && styles.bottomNavItemActive]}>
              <Ionicons name={activeTabKey === 'Wallet' ? 'card' : 'card-outline'} size={22} color={activeTabKey === 'Wallet' ? colors.brand : '#3f3f46'} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openRoute('Dashboard')} style={[styles.bottomNavItem, activeTabKey === 'Dashboard' && styles.bottomNavItemActive]}>
              <Ionicons name={activeTabKey === 'Dashboard' ? 'home' : 'home-outline'} size={22} color={activeTabKey === 'Dashboard' ? colors.brand : '#3f3f46'} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openRoute('Notifications')} style={[styles.bottomNavItem, activeRoute.key === 'Notifications' && styles.bottomNavItemActive]}>
              <View style={styles.notificationIconWrap}>
                <Ionicons name={activeRoute.key === 'Notifications' ? 'notifications' : 'notifications-outline'} size={22} color={activeRoute.key === 'Notifications' ? colors.brand : '#3f3f46'} />
                {unreadCount > 0 ? (
                  <Text style={styles.notificationCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openRoute('Profile')} style={[styles.bottomNavItem, activeTabKey === 'Profile' && styles.bottomNavItemActive]}>
              <Ionicons name={activeTabKey === 'Profile' ? 'person' : 'person-outline'} size={22} color={activeTabKey === 'Profile' ? colors.brand : '#3f3f46'} />
            </Pressable>
          </View>
        ) : null}
        <Modal animationType="fade" transparent visible={isNavOpen} onRequestClose={() => setIsNavOpen(false)}>
          <View style={styles.overlay}>
            <Pressable accessibilityRole="button" onPress={() => setIsNavOpen(false)} style={styles.scrim} />
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>C</Text>
                </View>
                <View style={styles.sidebarTitleWrap}>
                  <Text style={styles.sidebarTitle}>Parakleo</Text>
                  <Text style={styles.sidebarSubtitle}>student workspace</Text>
                </View>
              </View>
              <View style={styles.navList}>
                {studentTabs
                  .filter((tab) => ['Dashboard', 'Requests', 'Wallet', 'Profile'].includes(tab.key))
                  .map((tab) => (
                    <Pressable
                      accessibilityRole="button"
                      key={tab.key}
                      onPress={() => openRoute(tab.key)}
                      style={[styles.navItem, activeTabKey === tab.key && styles.navItemActive]}
                    >
                      <Text style={[styles.navText, activeTabKey === tab.key && styles.navTextActive]}>{tab.label}</Text>
                    </Pressable>
                  ))}
              </View>
              <View style={styles.sidebarFooter}>
                <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.navItem}>
                  <Text style={styles.navText}>Log out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  safeFullscreen: {
    paddingTop: 0,
  },
  shell: {
    flex: 1,
  },
  topbar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 66,
    paddingHorizontal: 12,
  },
  topbarSpacer: {
    flex: 1,
  },
  topbarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '80%',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: 10,
    position: 'relative',
  },
  referralButton: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  notificationCount: {
    backgroundColor: '#f43f5e',
    borderRadius: 9,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    right: -4,
    textAlign: 'center',
    top: -4,
  },
  identityPill: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  identityName: {
    color: '#3f3f46',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  contentSafe: {
    flex: 1,
  },
  content: {
    paddingBottom: 96,
    padding: 16,
    paddingTop: 36,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    zIndex: 20,
  },
  bottomNavItem: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 52,
  },
  bottomNavItemActive: {
    backgroundColor: '#ecfdf5',
  },
  notificationIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  sidebar: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    bottom: 12,
    left: 12,
    padding: 16,
    position: 'absolute',
    top: 12,
    width: '85%',
  },
  sidebarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  sidebarTitleWrap: {
    flex: 1,
  },
  sidebarTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sidebarSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  navList: {
    gap: 6,
  },
  navItem: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navItemActive: {
    backgroundColor: colors.brand,
  },
  navItemDark: {
    backgroundColor: colors.text,
  },
  navText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  navTextActive: {
    color: '#ffffff',
  },
  navTextDark: {
    color: '#ffffff',
  },
  sidebarFooter: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 6,
    marginTop: 'auto',
    paddingTop: 16,
  },
});
