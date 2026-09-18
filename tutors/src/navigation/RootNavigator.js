import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/auth/HomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { TutorDashboardScreen } from '../screens/dashboard/TutorDashboardScreen';
import { AvailableRequestsScreen } from '../screens/requests/AvailableRequestsScreen';
import { MyClassesScreen } from '../screens/classes/MyClassesScreen';
import { TutorSessionsScreen } from '../screens/history/TutorSessionsScreen';
import { TutorPaymentsScreen } from '../screens/payments/TutorPaymentsScreen';
import { TutorProfileScreen } from '../screens/profile/TutorProfileScreen';
import { TutorAccountScreen } from '../screens/profile/TutorAccountScreen';
import { TutorQualificationsScreen } from '../screens/profile/TutorQualificationsScreen';
import { TutorLegalScreen } from '../screens/profile/TutorLegalScreen';
import { TutorMetricsScreen } from '../screens/profile/TutorMetricsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { TutorOnboardingScreen } from '../screens/onboarding/TutorOnboardingScreen';
import { TutorReviewStatusScreen } from '../screens/onboarding/TutorReviewStatusScreen';
import { TutorAgreementScreen } from '../screens/onboarding/TutorAgreementScreen';
import { SessionRoomScreen } from '../screens/session/SessionRoomScreen';
import { TutorActiveSessionScreen } from '../screens/session/TutorActiveSessionScreen';
import { TutorSessionSummaryScreen } from '../screens/session/TutorSessionSummaryScreen';
import { TutorNavigationScreen } from '../screens/navigation/TutorNavigationScreen';
import { TutorRequestDetailsScreen } from '../screens/requests/TutorRequestDetailsScreen';
import { getTutorOnboardingStatus } from '../constants/onboarding';
import { TutorOfferOverlay } from '../components/offers/TutorOfferOverlay';
import { colors } from '../theme/colors';

const authScreens = {
  Home: HomeScreen,
  Login: LoginScreen,
  Signup: SignupScreen,
};

// 4 Navigation tabs as specified by user: Home, History, Payouts, Settings
const tutorTabs = [
  {
    key: 'Dashboard',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    component: TutorDashboardScreen,
  },
  {
    key: 'Sessions',
    label: 'History',
    icon: 'list-outline',
    iconActive: 'list',
    component: TutorSessionsScreen,
  },
  {
    key: 'Earnings',
    label: 'Payouts',
    icon: 'wallet-outline',
    iconActive: 'wallet',
    component: TutorPaymentsScreen,
  },
  {
    key: 'Profile',
    label: 'Settings',
    icon: 'settings-outline',
    iconActive: 'settings',
    component: TutorProfileScreen,
  },
];

const modalScreens = {
  Notifications: NotificationsScreen,
  Onboarding: TutorOnboardingScreen,
  ReviewStatus: TutorReviewStatusScreen,
  Agreement: TutorAgreementScreen,
  SessionRoom: SessionRoomScreen,
  TutorActiveSession: TutorActiveSessionScreen,
  ActiveSession: TutorActiveSessionScreen,
  TutorSessionSummary: TutorSessionSummaryScreen,
  SessionSummary: TutorSessionSummaryScreen,
  TutorNavigation: TutorNavigationScreen,
  TutorRequestDetails: TutorRequestDetailsScreen,
  RequestDetails: TutorRequestDetailsScreen,
  AvailableRequests: AvailableRequestsScreen,
  MyClasses: MyClassesScreen,
  TutorAccount: TutorAccountScreen,
  TutorQualifications: TutorQualificationsScreen,
  TutorLegal: TutorLegalScreen,
  TutorMetrics: TutorMetricsScreen,
};

export function RootNavigator() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();
  const [authScreen, setAuthScreen] = useState('Home');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [modalParams, setModalParams] = useState({});
  const [, setNavHistory] = useState([]);
  const navHistoryRef = useRef([]);
  const authScreenRef = useRef('Home');
  const activeTabRef = useRef('Dashboard');
  const activeModalRef = useRef(null);
  const modalParamsRef = useRef({});
  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user || {}), [user]);
  const verificationStatus = useMemo(() => {
    return String(user?.tutorProfile?.verificationStatus || user?.verificationStatus || 'pending').toLowerCase();
  }, [user?.tutorProfile?.verificationStatus, user?.verificationStatus]);
  const isVerified = verificationStatus === 'verified';

  useEffect(() => {
    authScreenRef.current = authScreen;
  }, [authScreen]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeModalRef.current = activeModal;
    modalParamsRef.current = modalParams;
  }, [activeModal, modalParams]);

  useEffect(() => {
    navHistoryRef.current = [];
    setNavHistory([]);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!onboardingStatus.complete) {
      if (activeModal === 'Agreement') return;
      setModalParams({ initialStep: onboardingStatus.firstMissingStep });
      setActiveModal('Onboarding');
      return;
    }

    if (!isVerified) {
      if (activeModal === 'Onboarding' || activeModal === 'Agreement') return;
      if (activeModal !== 'ReviewStatus') {
        setModalParams({});
        setActiveModal('ReviewStatus');
      }
      return;
    }

    if (isVerified && activeModal === 'ReviewStatus') {
      setActiveModal(null);
      setModalParams({});
    }
  }, [activeModal, isVerified, onboardingStatus.complete, onboardingStatus.firstMissingStep, user?.uid]);

  const getCurrentNavigationEntry = () => {
    if (!user?.uid) {
      return {
        type: 'auth',
        screen: authScreenRef.current,
        params: {},
      };
    }

    if (activeModalRef.current) {
      return {
        type: 'modal',
        screen: activeModalRef.current,
        params: modalParamsRef.current || {},
      };
    }

    return {
      type: 'tab',
      screen: activeTabRef.current,
      params: {},
    };
  };

  const applyNavigationEntry = (entry) => {
    if (!entry?.screen) return;

    if (entry.type === 'auth') {
      setAuthScreen(authScreens[entry.screen] ? entry.screen : 'Login');
      return;
    }

    if (entry.type === 'modal') {
      setModalParams(entry.params || {});
      setActiveModal(entry.screen);
      return;
    }

    setActiveModal(null);
    setModalParams({});
    setActiveTab(tutorTabs.some((tab) => tab.key === entry.screen) ? entry.screen : 'Dashboard');
  };

  const pushCurrentNavigationEntry = (nextEntry) => {
    const currentEntry = getCurrentNavigationEntry();
    const currentKey = JSON.stringify(currentEntry);
    const nextKey = JSON.stringify(nextEntry);
    if (currentKey === nextKey) return;

    const nextHistory = [...navHistoryRef.current, currentEntry];
    navHistoryRef.current = nextHistory;
    setNavHistory(nextHistory);
  };

  const navigate = (target, rawParams = {}) => {
    const screenName = typeof target === 'string' ? target : (target?.key || target?.screen || target?.name);
    const params = (typeof target === 'object' && target !== null && !Array.isArray(target) && target.params)
      ? target.params
      : (typeof rawParams === 'object' && rawParams !== null ? rawParams : {});

    if (!screenName) return;

    if (!user) {
      if (authScreens[screenName]) {
        pushCurrentNavigationEntry({ type: 'auth', screen: screenName, params: {} });
        setAuthScreen(screenName);
      }
      return;
    }

    if (modalScreens[screenName]) {
      pushCurrentNavigationEntry({ type: 'modal', screen: screenName, params });
      setModalParams(params);
      setActiveModal(screenName);
      return;
    }

    const targetTab = tutorTabs.find((tab) => tab.key === screenName);
    if (targetTab) {
      pushCurrentNavigationEntry({ type: 'tab', screen: screenName, params: {} });
      setActiveModal(null);
      setModalParams({});
      setActiveTab(screenName);
    }
  };

  const goBack = () => {
    if (!user) {
      if (navHistoryRef.current.length > 0) {
        const nextHistory = [...navHistoryRef.current];
        const previousEntry = nextHistory.pop();
        navHistoryRef.current = nextHistory;
        setNavHistory(nextHistory);
        applyNavigationEntry(previousEntry);
        return true;
      }
      if (authScreenRef.current !== 'Login') {
        setAuthScreen('Login');
      }
      return true;
    }

    if (activeModal) {
      if (activeModal === 'Onboarding' && !onboardingStatus.complete) {
        setModalParams({ initialStep: onboardingStatus.firstMissingStep });
        return true;
      }
      if (activeModal === 'ReviewStatus' && !isVerified) {
        return true;
      }
    }

    if (navHistoryRef.current.length > 0) {
      const nextHistory = [...navHistoryRef.current];
      const previousEntry = nextHistory.pop();
      navHistoryRef.current = nextHistory;
      setNavHistory(nextHistory);
      applyNavigationEntry(previousEntry);
      return true;
    }

    if (activeTab !== 'Dashboard') {
      setActiveTab('Dashboard');
      return true;
    }

    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => goBack());
    return () => subscription.remove();
  }, [activeModal, activeTab, authScreen, onboardingStatus.complete, onboardingStatus.firstMissingStep, user?.uid]);

  if (initializing) {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.loadingContainer}>
        <LoadingState message="Initializing Parakleo Tutors..." />
      </SafeAreaView>
    );
  }

  // 1. Unauthenticated Auth Flow
  if (!user) {
    const AuthComponent = authScreens[authScreen] || HomeScreen;
    return <AuthComponent navigate={navigate} goBack={goBack} />;
  }

  // 2. Active Full-Screen Modal Screen (e.g. SessionRoom, Onboarding, Notifications, Subpages)
  if (activeModal && modalScreens[activeModal]) {
    const ModalComponent = modalScreens[activeModal];
    if (
      activeModal === 'SessionRoom'
      || activeModal === 'TutorNavigation'
      || activeModal === 'TutorActiveSession'
      || activeModal === 'ActiveSession'
      || activeModal === 'TutorSessionSummary'
      || activeModal === 'SessionSummary'
    ) {
      return <ModalComponent route={{ params: modalParams }} navigate={navigate} goBack={goBack} />;
    }
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.appContainer}>
        <View style={styles.screenContainer}>
          <ModalComponent route={{ params: modalParams }} navigate={navigate} goBack={goBack} />
        </View>
      </SafeAreaView>
    );
  }

  // 3. Authenticated Tab Flow
  const currentTabConfig = tutorTabs.find((tab) => tab.key === activeTab) || tutorTabs[0];
  const CurrentScreenComponent = currentTabConfig.component;

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.appContainer}>
      <View style={styles.screenContainer}>
        <CurrentScreenComponent navigate={navigate} goBack={goBack} />
      </View>

      {/* Floating Bottom Navigation Bar (Matching middle screenshot layout) */}
      <View
        style={[
          styles.floatingBar,
          { bottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {tutorTabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => navigate(tab.key)}
              style={({ pressed }) => [
                isActive ? styles.activeTabPill : styles.inactiveTabButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={isActive ? 18 : 22}
                color={isActive ? '#ffffff' : '#9ca3af'}
              />
              {isActive ? (
                <Text style={styles.activeTabLabel}>{tab.label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Global incoming class offer overlay */}
      {!activeModal && <TutorOfferOverlay bottomSafeInset={insets.bottom} onNavigate={navigate} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenContainer: {
    flex: 1,
  },
  floatingBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    backgroundColor: '#ffffff',
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 64,
    height: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeTabPill: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    borderRadius: 27,
    gap: 7,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  activeTabLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  inactiveTabButton: {
    height: 54,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
