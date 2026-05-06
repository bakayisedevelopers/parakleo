import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/ui/States';
import { NotificationCenterModal } from '../components/student/NotificationCenterModal';
import { SessionRatingPrompt } from '../components/student/SessionRatingPrompt';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/auth/HomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { DashboardScreen } from '../screens/student/DashboardScreen';
import { OnboardingScreen } from '../screens/student/OnboardingScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { RequestDetailsScreen } from '../screens/student/RequestDetailsScreen';
import { RequestStatusScreen } from '../screens/student/RequestStatusScreen';
import { RequestsScreen } from '../screens/student/RequestsScreen';
import { SessionRoomScreen } from '../screens/student/SessionRoomScreen';
import { SessionsScreen } from '../screens/student/SessionsScreen';
import { WalletScreen } from '../screens/student/WalletScreen';
import { markNotificationsRead, subscribeToNotifications } from '../services/notificationService';
import { subscribeToStudentSessions } from '../services/sessionService';
import { colors } from '../theme/colors';
import { RATABLE_SESSION_STATUSES, isLiveSessionStatus } from '../utils/sessionStatus';

const authScreens = {
  Home: HomeScreen,
  Login: LoginScreen,
  Signup: SignupScreen,
};

const studentTabs = [
  { key: 'Dashboard', label: 'Home', component: DashboardScreen },
  { key: 'Onboarding', label: 'Complete Profile', component: OnboardingScreen },
  { key: 'Requests', label: 'My Classes', component: RequestsScreen },
  { key: 'Sessions', label: 'Sessions', component: SessionsScreen },
  { key: 'Wallet', label: 'Payment', component: WalletScreen },
  { key: 'Profile', label: 'Profile', component: ProfileScreen },
];

const detailScreens = {
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

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
      setNotifications([]);
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
      return () => {};
    }

    return subscribeToStudentSessions(
      user.uid,
      (items) => setSessions(items),
      () => setSessions([]),
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    const unreadIds = notifications.filter((item) => !item?.read).map((item) => item.id);
    markNotificationsRead(unreadIds).catch(() => null);
  }, [isNotificationsOpen, notifications]);

  if (initializing) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState label="Restoring session" />
      </SafeAreaView>
    );
  }

  if (!user) {
    const AuthScreen = authScreens[authRoute];
    return (
      <SafeAreaView style={styles.safe}>
        <AuthScreen navigate={setAuthRoute} />
      </SafeAreaView>
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
  const liveSession = sessions.find((session) => isLiveSessionStatus(session.status)) || null;
  const ratingTarget = useMemo(
    () => sessions.find((session) => RATABLE_SESSION_STATUSES.includes(String(session.status || '').toLowerCase()) && (session?.ratingStatus?.student || 'pending') === 'pending') || null,
    [sessions],
  );

  const handleLogout = async () => {
    setAuthRoute('Home');
    setIsNavOpen(false);
    setActiveRoute({ key: 'Dashboard', params: {} });
    await logout();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        {!isFullscreenRoute ? (
          <View style={styles.topbar}>
            <Pressable accessibilityRole="button" onPress={() => setIsNavOpen(true)} style={styles.menuButton}>
              <Text style={styles.menuIcon}>Menu</Text>
            </Pressable>
            <View style={styles.topbarSpacer} />
            <View style={styles.topbarActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openRoute(liveSession?.id ? { key: 'SessionRoom', params: { sessionId: liveSession.id, parentTab: 'Sessions' } } : 'Requests')}
                style={styles.iconButton}
              >
                <Text style={styles.iconText}>Go</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setIsNotificationsOpen(true)} style={styles.iconButton}>
                <Text style={styles.iconText}>Bell</Text>
                {unreadCount ? <View style={styles.notificationDot} /> : null}
              </Pressable>
              <View style={styles.identityPill}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{String(user?.fullName || user?.displayName || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.identityName} numberOfLines={1}>{user?.fullName || user?.displayName || 'Claxi User'}</Text>
              </View>
            </View>
          </View>
        ) : null}
        {isFullscreenRoute ? (
          <ActiveScreen navigate={openRoute} goBack={goBack} route={activeRoute} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <ActiveScreen navigate={openRoute} goBack={goBack} route={activeRoute} />
          </ScrollView>
        )}
        <Modal animationType="fade" transparent visible={isNavOpen} onRequestClose={() => setIsNavOpen(false)}>
          <View style={styles.overlay}>
            <Pressable accessibilityRole="button" onPress={() => setIsNavOpen(false)} style={styles.scrim} />
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>C</Text>
                </View>
                <View style={styles.sidebarTitleWrap}>
                  <Text style={styles.sidebarTitle}>Claxi</Text>
                  <Text style={styles.sidebarSubtitle}>student workspace</Text>
                </View>
              </View>
              <View style={styles.navList}>
                {studentTabs
                  .filter((tab) => ['Dashboard', 'Requests', 'Sessions', 'Wallet'].includes(tab.key))
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openRoute('Onboarding')}
                  style={[styles.navItem, activeTabKey === 'Onboarding' && styles.navItemDark]}
                >
                  <Text style={[styles.navText, activeTabKey === 'Onboarding' && styles.navTextDark]}>Complete Profile</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openRoute('Profile')}
                  style={[styles.navItem, activeTabKey === 'Profile' && styles.navItemDark]}
                >
                  <Text style={[styles.navText, activeTabKey === 'Profile' && styles.navTextDark]}>Profile</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.navItem}>
                  <Text style={styles.navText}>Log out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <NotificationCenterModal
          visible={isNotificationsOpen}
          notifications={notifications}
          isLoading={notificationsLoading}
          onClose={() => setIsNotificationsOpen(false)}
          onOpenNotification={(notification) => {
            setIsNotificationsOpen(false);
            openRoute(resolveNotificationRoute(notification));
          }}
          onOpenRequest={(requestId) => {
            setIsNotificationsOpen(false);
            openRoute({ key: 'RequestStatus', params: { requestId, parentTab: 'Requests' } });
          }}
          onOpenSession={(sessionId) => {
            setIsNotificationsOpen(false);
            openRoute({ key: 'SessionRoom', params: { sessionId, parentTab: 'Sessions' } });
          }}
        />
        <SessionRatingPrompt session={ratingTarget} role="student" onHandled={() => null} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
    margin: 12,
    padding: 12,
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
  menuIcon: {
    color: '#3f3f46',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
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
  iconText: {
    color: '#3f3f46',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notificationDot: {
    backgroundColor: '#f43f5e',
    borderRadius: 5,
    height: 8,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 8,
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
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  identityName: {
    color: '#3f3f46',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingTop: 4,
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
