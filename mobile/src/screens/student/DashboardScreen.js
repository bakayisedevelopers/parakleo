import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationsButton } from '../../components/navigation/NotificationsButton';
import { useAuth } from '../../context/AuthContext';
import {
  isActiveLessonStatus,
  isActiveTrackingStatus,
} from '../../constants/lessonStatus';
import { normalizeRequestStatus } from '../../utils/requestStatus';

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning,';
  if (hour < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export function DashboardScreen({ navigate, unreadCount = 0, requests = [], sessions = [] }) {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const studentRequests = Array.isArray(requests) ? requests : [];
  const studentSessions = Array.isArray(sessions) ? sessions : [];

  const displayName = String(user?.fullName || user?.displayName || 'Student').trim();
  const greeting = getTimeOfDayGreeting();
  const photoURL = user?.profilePhoto || user?.photoURL;
  const initial = displayName.charAt(0).toUpperCase() || 'S';
  const activeSession = useMemo(() => {
    return studentSessions.find((s) => isActiveLessonStatus(normalizeRequestStatus(s?.status))) || null;
  }, [studentSessions]);

  const trackingSession = useMemo(() => {
    return studentSessions.find((s) => isActiveTrackingStatus(normalizeRequestStatus(s?.status))) || null;
  }, [studentSessions]);

  const activeRequest = useMemo(() => {
    return studentRequests.find((r) =>
      ['pending', 'matching', 'offered', 'no_tutor_available'].includes(normalizeRequestStatus(r?.status))
        || isActiveTrackingStatus(normalizeRequestStatus(r?.status))
    ) || null;
  }, [studentRequests]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />
      <View pointerEvents="none" style={styles.backdropLayer}>
        <Image
          source={require('../../../assets/student-home-tutoring.png')}
          style={styles.backgroundArt}
          resizeMode={width > height ? 'contain' : 'cover'}
          accessible={false}
        />
      </View>

      <SafeAreaView style={styles.safeContainer}>
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          {/* User Avatar + Greeting */}
          <View style={styles.userInfoLeft}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.greetingWrap}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>

          {/* Notifications stay accessible above the home artwork. */}
          <NotificationsButton
            navigate={navigate}
            unreadCount={unreadCount}
          />
        </View>

        {/* Keep ongoing lessons reachable above the background artwork. */}
        <ScrollView
          style={styles.centerScroll}
          contentContainerStyle={styles.centerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Lesson In-Progress Banner */}
          {activeSession ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                navigate?.({
                  key: 'ActiveSession',
                  params: {
                    sessionId: activeSession.id,
                    session: activeSession,
                    parentTab: 'Dashboard',
                  },
                });
              }}
              style={styles.activeSessionBanner}
            >
              <View style={styles.activeSessionBannerLeft}>
                <View style={styles.pulseGreenDot} />
                <View style={styles.activeSessionBannerTextWrap}>
                  <Text style={styles.activeSessionBannerTitle}>Lesson in Progress • Tutor Arrived</Text>
                  <Text style={styles.activeSessionBannerSubtitle}>
                    {activeSession.subject || 'Lesson'} with {activeSession.tutorName || 'Your Tutor'}
                  </Text>
                </View>
              </View>
              <View style={styles.activeSessionResumeBtn}>
                <Text style={styles.activeSessionResumeText}>Resume</Text>
                <Ionicons name="arrow-forward" size={14} color="#059669" />
              </View>
            </Pressable>
          ) : trackingSession ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const requestId = trackingSession.requestId || trackingSession.id;
                navigate?.({
                  key: 'SessionScreen',
                  params: {
                    requestId,
                    activeRequestId: requestId,
                    request: trackingSession,
                    subject: trackingSession.subject || 'Lesson',
                    topic: trackingSession.topic || '',
                    parentTab: 'Dashboard',
                  },
                });
              }}
              style={styles.activeSessionBanner}
            >
              <View style={styles.activeSessionBannerLeft}>
                <View style={styles.pulseGreenDot} />
                <View style={styles.activeSessionBannerTextWrap}>
                  <Text style={styles.activeSessionBannerTitle}>Tutor Accepted • Live Tracking Active</Text>
                  <Text style={styles.activeSessionBannerSubtitle}>
                    {trackingSession.subject || 'Lesson'} with {trackingSession.tutorName || 'Your Tutor'}
                  </Text>
                </View>
              </View>
              <View style={styles.activeSessionResumeBtn}>
                <Text style={styles.activeSessionResumeText}>Resume</Text>
                <Ionicons name="arrow-forward" size={14} color="#059669" />
              </View>
            </Pressable>
          ) : activeRequest ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                navigate?.({
                  key: 'SessionScreen',
                  params: {
                    requestId: activeRequest.id,
                    activeRequestId: activeRequest.id,
                    request: activeRequest,
                    subject: activeRequest.subject || 'Lesson',
                    topic: activeRequest.topic || '',
                    parentTab: 'Dashboard',
                  },
                });
              }}
              style={styles.activeSessionBanner}
            >
              <View style={styles.activeSessionBannerLeft}>
                <View style={styles.pulseGreenDot} />
                <View style={styles.activeSessionBannerTextWrap}>
                  <Text style={styles.activeSessionBannerTitle}>
                    {['accepted', 'tutor_accepted', 'traveling', 'travelling'].includes(String(activeRequest.status || '').toLowerCase())
                      ? 'Tutor Travelling • Live Request Active'
                      : 'Connecting with Tutor • Request Active'}
                  </Text>
                  <Text style={styles.activeSessionBannerSubtitle}>
                    {activeRequest.subject || 'Lesson'} • Tap to view live map & tracking
                  </Text>
                </View>
              </View>
              <View style={styles.activeSessionResumeBtn}>
                <Text style={styles.activeSessionResumeText}>Resume</Text>
                <Ionicons name="arrow-forward" size={14} color="#059669" />
              </View>
            </Pressable>
          ) : null}

        </ScrollView>

      </SafeAreaView>


    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f0fdf4',
    flex: 1,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundArt: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 12,
    zIndex: 1,
  },
  topHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  userInfoLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 16,
  },
  avatarImage: {
    borderColor: '#10b981',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    width: 44,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderColor: '#bbf7d0',
    borderRadius: 22,
    borderWidth: 2,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    width: 44,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  greetingWrap: {
    gap: 1,
    flex: 1,
    minWidth: 0,
  },
  greetingText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  userNameText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    maxWidth: 200,
  },
  centerScroll: {
    flex: 1,
    marginVertical: 4,
  },
  centerScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
    alignItems: 'center',
  },
  activeSessionBanner: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderColor: '#86efac',
    borderRadius: 20,
    borderWidth: 1.5,
    elevation: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  activeSessionBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  pulseGreenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
    marginRight: 10,
  },
  activeSessionBannerTextWrap: {
    flex: 1,
  },
  activeSessionBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
  },
  activeSessionBannerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activeSessionResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  activeSessionResumeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginRight: 4,
  },
});
