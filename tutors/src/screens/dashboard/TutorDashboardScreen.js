import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LiveSessionBanner } from '../../components/dashboard/LiveSessionBanner';
import { CircularOnlineDial } from '../../components/dashboard/CircularOnlineDial';
import { StackedMetricsCard } from '../../components/dashboard/StackedMetricsCard';
import { useAuth } from '../../context/AuthContext';
import { useTutorSessions } from '../../hooks/useSessions';
import { useTutorAcceptedRequests } from '../../hooks/useClassRequests';
import { getTutorOnboardingStatus } from '../../constants/onboarding';
import { getUserProfile, updateTutorOnlineStatus } from '../../services/userService';
import { cancelClassRequestAndSession } from '../../services/classRequestService';
import { resolveTutorDispatchLocation, saveUserLiveLocation } from '../../services/locationService';
import { colors } from '../../theme/colors';

export function TutorDashboardScreen({ navigate }) {
  const { user, setUser } = useAuth();
  const { sessions, isLoading: loadingSessions } = useTutorSessions(user?.uid);
  const { classes: acceptedRequests } = useTutorAcceptedRequests(user?.uid);

  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [cancelingClass, setCancelingClass] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const tutorProfile = user?.tutorProfile || {};
  const isOnline = user?.onlineStatus === 'online';
  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user), [user]);
  const verificationStatus = (user?.tutorProfile?.verificationStatus || user?.verificationStatus || 'pending').toLowerCase();
  const isVerified = verificationStatus === 'verified';
  const rejectionReason = user?.tutorProfile?.rejectionReason || user?.tutorProfile?.rejectionFeedback || user?.rejectionReason || '';

  const hasDispatchLocation = Boolean(
    user?.liveLocation?.latitude
      || user?.homeLocation?.latitude
      || user?.location?.latitude
      || user?.tutorProfile?.liveLocation?.latitude
      || user?.tutorProfile?.homeLocation?.latitude
      || user?.tutorProfile?.location?.latitude,
  );

  // Find active in-progress or ready-to-join session
  const activeSession = useMemo(() => {
    return sessions.find((s) => ['waiting_student', 'in_progress', 'in_session'].includes(s.status)) || null;
  }, [sessions]);

  // Find matching or active accepted request
  const activeRequest = useMemo(() => {
    if (activeSession?.requestId) {
      const match = acceptedRequests.find((r) => r.id === activeSession.requestId);
      if (match) return match;
    }
    if (user?.activeClassRequestId) {
      const match = acceptedRequests.find((r) => r.id === user.activeClassRequestId);
      if (match) return match;
    }
    return acceptedRequests[0] || null;
  }, [acceptedRequests, activeSession?.requestId, user?.activeClassRequestId]);

  const activeClass = activeSession || activeRequest;

  const dispatchMetrics = {
    acceptanceRate: Number(tutorProfile.acceptanceRate ?? user?.acceptanceRate ?? 100),
    completionRate: Number(tutorProfile.completionRate ?? user?.completionRate ?? 100),
    overallRating: Number(tutorProfile.overallRating ?? user?.overallRating ?? 5.0),
    avgResponseSeconds: Number(tutorProfile.avgResponseSeconds ?? user?.avgResponseSeconds ?? 15),
    cancellationRate: Number(tutorProfile.cancellationRate ?? user?.cancellationRate ?? 0),
    recentAssignmentsCount: Number(tutorProfile.completedSessionsLast24Hours ?? tutorProfile.recentAssignmentsCount ?? 0),
  };

  // Determine greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Extract tutor first name
  const tutorFirstName = useMemo(() => {
    const full = user?.fullName || user?.displayName || 'Tutor';
    return full.split(' ')[0];
  }, [user]);

  const handleToggleOnline = async (value) => {
    if (!user?.uid) return;
    if (!onboardingStatus.complete && value) {
      Alert.alert(
        'Profile Incomplete',
        'Please complete your onboarding profile and sign the tutor agreement before going online.',
        [{ text: 'Complete Profile', onPress: () => navigate('Onboarding') }]
      );
      return;
    }

    if (!isVerified && value) {
      if (verificationStatus === 'rejected') {
        Alert.alert(
          'Verification Rejected',
          rejectionReason
            ? `Your document verification was rejected: "${rejectionReason}". Please update your documents to proceed.`
            : 'Your verification was rejected. Please review and update your documents.',
          [{ text: 'Update Documents', onPress: () => navigate('Onboarding') }]
        );
      } else {
        Alert.alert(
          'Verification Pending',
          'Your profile and documents are currently under review. The online toggle will unlock automatically once your account is verified.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    try {
      setTogglingOnline(true);
      let liveLocation = null;
      if (value) {
        const locationResult = await resolveTutorDispatchLocation(user);
        liveLocation = locationResult.location;
        setLocationMessage(locationResult.message || '');

        if (!liveLocation) {
          Alert.alert(
            'Location Required',
            locationResult.message || 'Please enable location before going online for in-person student requests.',
            [
              { text: 'Cancel', style: 'cancel' },
              ...(locationResult.canOpenSettings
                ? [{ text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => null) }]
                : []),
            ],
          );
          return;
        }
      } else {
        setLocationMessage('');
      }

      if (liveLocation) {
        await saveUserLiveLocation(user.uid, liveLocation).catch(() => null);
      }
      await updateTutorOnlineStatus(user.uid, value ? 'online' : 'offline', liveLocation);
      setUser((prev) => ({
        ...prev,
        onlineStatus: value ? 'online' : 'offline',
        ...(liveLocation ? { liveLocation, location: liveLocation } : {}),
      }));
    } catch (err) {
      console.error('Failed to toggle online status:', err);
      Alert.alert(
        'Could Not Update Status',
        err?.message || 'Unable to update your online status right now. Please try again.',
      );
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleJoinClass = () => {
    const isInPerson = activeClass?.mode === 'in_person'
      || activeRequest?.mode === 'in_person'
      || activeSession?.mode === 'in_person'
      || Boolean(
        activeRequest?.destination
          || activeRequest?.studentLocation
          || activeSession?.destination
          || activeSession?.studentLocation
          || activeRequest?.studentAddress
      );

    const requestId = activeClass?.requestId
      || activeRequest?.id
      || activeSession?.requestId
      || user?.activeClassRequestId
      || '';
    const sessionId = activeSession?.id || activeRequest?.sessionId || '';

    if (isInPerson) {
      const status = String(activeSession?.status || activeRequest?.status || activeClass?.status || '').toLowerCase();
      if (['in_progress', 'in_session'].includes(status)) {
        navigate('TutorActiveSession', {
          requestId,
          sessionId: sessionId || requestId,
          request: activeRequest || activeSession,
        });
      } else {
        navigate('TutorNavigation', {
          requestId,
          sessionId,
          request: activeRequest || activeSession,
        });
      }
    } else if (sessionId) {
      navigate('SessionRoom', { sessionId });
    } else {
      navigate('MyClasses');
    }
  };

  const handleCancelClass = () => {
    const requestId = activeClass?.requestId
      || activeRequest?.id
      || activeSession?.requestId
      || user?.activeClassRequestId
      || '';
    const sessionId = activeSession?.id || activeRequest?.sessionId || '';

    Alert.alert(
      'Cancel Class?',
      'Are you sure you want to cancel this in-progress class? This will release the student request, cancel the active session, and stop live tracking.',
      [
        { text: 'Keep Class', style: 'cancel' },
        {
          text: 'Yes, Cancel Class',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelingClass(true);
              await cancelClassRequestAndSession({
                requestId,
                sessionId,
                tutorId: user?.uid,
                reason: 'Canceled by tutor from dashboard',
              });
              setUser((prev) => ({
                ...prev,
                activeClassRequestId: null,
              }));
              Alert.alert('Class Canceled', 'The class session and request have been canceled.');
            } catch (err) {
              console.error('Failed to cancel class:', err);
              Alert.alert('Cancel Failed', err?.message || 'Unable to cancel this class. Please try again.');
            } finally {
              setCancelingClass(false);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      const updated = await getUserProfile(user.uid);
      if (updated) setUser((prev) => ({ ...prev, ...updated }));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />}
      >
        {/* TOP HEADER PILL CARD (matching screenshot top bar) */}
        <View style={styles.headerCapsule}>
          <View style={styles.headerLeft}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {tutorFirstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.greetingText}>
              {`${greeting}, ${tutorFirstName}!`}
            </Text>
          </View>

          <Pressable
            onPress={() => navigate('Notifications')}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="notifications-outline" size={20} color="#18181b" />
          </Pressable>
        </View>

        {/* ACTIVE LIVE SESSION BANNER (if currently teaching or student waiting) */}
        {activeClass ? (
          <View style={styles.bannerSpacing}>
            <LiveSessionBanner
              session={activeSession || activeRequest}
              request={activeRequest}
              onJoin={handleJoinClass}
              onCancel={handleCancelClass}
              isCanceling={cancelingClass}
            />
          </View>
        ) : null}

        {/* ONBOARDING WARNING NOTICE (if incomplete) */}
        {!onboardingStatus.complete ? (
          <Card style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.amber} />
              <Text style={styles.warningTitle}>Complete Your Tutor Profile</Text>
            </View>
            <Text style={styles.warningDesc}>
              {onboardingStatus.message || 'You must complete all onboarding steps and sign the tutor agreement before receiving class offers.'}
            </Text>
            <Button
              variant="primary"
              size="sm"
              onPress={() => navigate('Onboarding')}
              style={styles.onboardingButton}
            >
              Continue Onboarding
            </Button>
          </Card>
        ) : null}

        {/* VERIFICATION REJECTED NOTICE (if rejected by admin) */}
        {onboardingStatus.complete && !isVerified && verificationStatus === 'rejected' ? (
          <Card style={styles.rejectionCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={[styles.warningTitle, { color: colors.danger }]}>Verification Rejected</Text>
            </View>
            <Text style={styles.warningDesc}>
              {rejectionReason || 'One or more of your documents were rejected. Please review and update your documents.'}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onPress={() => navigate('Onboarding')}
              style={[styles.onboardingButton, { borderColor: colors.danger }]}
            >
              Update Documents
            </Button>
          </Card>
        ) : null}

        {/* VERIFICATION UNDER REVIEW NOTICE (if awaiting review) */}
        {onboardingStatus.complete && !isVerified && verificationStatus !== 'rejected' ? (
          <Card style={styles.reviewCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="time-outline" size={20} color={colors.brandDark} />
              <Text style={[styles.warningTitle, { color: colors.brandDark }]}>Documents Under Review</Text>
            </View>
            <Text style={styles.warningDesc}>
              Your documents have been submitted and are under review by our admin team. The online toggle will unlock automatically as soon as your account is verified.
            </Text>
          </Card>
        ) : null}

        {onboardingStatus.complete && isVerified && (!hasDispatchLocation || locationMessage) ? (
          <Card style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons
                name={hasDispatchLocation ? 'location' : 'location-outline'}
                size={19}
                color={hasDispatchLocation ? colors.brand : colors.amber}
              />
              <Text style={styles.locationTitle}>
                {hasDispatchLocation ? 'Location ready' : 'Location needed for offers'}
              </Text>
            </View>
            <Text style={styles.locationDesc}>
              {locationMessage
                || 'Go online once and allow location access so Parakleo can match you with nearby in-person student requests.'}
            </Text>
          </Card>
        ) : null}

        {/* CENTER SECTION (Go Online and Tutor Performance vertically and horizontally centered) */}
        <View style={styles.centerSection}>
          <CircularOnlineDial
            isOnline={isOnline}
            toggling={togglingOnline}
            disabled={!onboardingStatus.complete || !isVerified}
            onToggle={handleToggleOnline}
          />

          <StackedMetricsCard metrics={dispatchMetrics} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110, // Generous padding for floating navigation bar
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  headerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brandDark,
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181b',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSpacing: {
    marginVertical: 8,
  },
  warningCard: {
    marginVertical: 10,
    borderColor: colors.amber,
    backgroundColor: colors.amberLight,
  },
  reviewCard: {
    marginVertical: 10,
    borderColor: colors.brandLight,
    backgroundColor: '#f0fdf4',
  },
  rejectionCard: {
    marginVertical: 10,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  warningDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  onboardingButton: {
    alignSelf: 'flex-start',
  },
  locationCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d1fae5',
    marginVertical: 10,
  },
  locationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  locationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  locationDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  requestsSection: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  offerCard: {
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
  },
  offerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  offerTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.amber,
  },
  offerTopic: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  offerStudent: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
  },
  declineBtn: {
    flex: 1,
  },
  quickLinksSection: {
    marginTop: 8,
    gap: 10,
  },
  quickLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickLinkIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickLinkInfo: {
    flex: 1,
  },
  quickLinkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  quickLinkDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
