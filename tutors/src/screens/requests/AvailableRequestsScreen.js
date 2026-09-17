import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Header } from '../../components/ui/Header';
import { OfferCountdownModal } from '../../components/offers/OfferCountdownModal';
import { useAuth } from '../../context/AuthContext';
import { useTutorAvailableRequests } from '../../hooks/useClassRequests';
import { getTutorOnboardingStatus } from '../../constants/onboarding';
import { acceptClassRequest, declineClassRequest } from '../../services/classRequestService';
import { findSessionIdByRequestAndTutor } from '../../services/sessionService';
import { calculateTutorOfferPayout } from '../../constants/pricing';
import { extractSafetySnapshot } from '../../constants/safety';
import { normalizeOfferExpiresAt } from '../../constants/lifecycle';
import { colors } from '../../theme/colors';

export function AvailableRequestsScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const { requests, isLoading } = useTutorAvailableRequests(user?.uid);
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user), [user]);
  const isOnline = user?.onlineStatus === 'online';

  // Live timer tick for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pop up offer countdown modal for the top incoming offer if unhandled
  useEffect(() => {
    if (requests.length > 0 && !activeModalRequest) {
      setActiveModalRequest(requests[0]);
    }
  }, [requests, activeModalRequest]);

  const filteredRequests = useMemo(() => {
    if (selectedSubject === 'All') return requests;
    return requests.filter((r) => r.subject?.toLowerCase() === selectedSubject.toLowerCase());
  }, [requests, selectedSubject]);

  const uniqueSubjects = useMemo(() => {
    const subs = new Set(requests.map((r) => r.subject).filter(Boolean));
    return ['All', ...Array.from(subs)];
  }, [requests]);

  const handleAcceptOffer = async (request) => {
    if (!request || !user?.uid) return;
    try {
      setIsProcessing(true);
      const acceptResult = await acceptClassRequest({
        requestId: request.id,
        tutorId: user.uid,
        tutorName: user.fullName || user.displayName || 'Tutor',
        tutorEmail: user.email,
      });

      setActiveModalRequest(null);
      const sessionId = acceptResult?.sessionId
        || await findSessionIdByRequestAndTutor({ requestId: request.id, tutorId: user.uid })
        || request.id;
      if (request.mode === 'in_person') {
        navigate('TutorNavigation', { requestId: request.id, sessionId, request });
      } else if (sessionId) {
        navigate('SessionRoom', { sessionId });
      } else {
        navigate('MyClasses');
      }
    } catch (err) {
      Alert.alert('Error Accepting Offer', err?.message || 'Unable to accept request.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclineOffer = async (request) => {
    if (!request || !user?.uid) return;
    try {
      setIsProcessing(true);
      await declineClassRequest({ requestId: request.id, tutorId: user.uid });
      setActiveModalRequest(null);
    } catch (err) {
      console.warn('Decline error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Available Offers"
        subtitle="Live match requests from students waiting for tutoring"
        onBack={goBack}
      />

      {/* Online & Onboarding Status Warning */}
      {(!isOnline || !onboardingStatus.complete) && (
        <View style={styles.offlineNotice}>
          <Ionicons name="information-circle" size={20} color={colors.amber} />
          <Text style={styles.offlineNoticeText}>
            {!onboardingStatus.complete
              ? 'Complete onboarding and sign the tutor agreement to receive student offers.'
              : 'You are currently offline. Turn on your online switch in Dashboard to receive live offers.'}
          </Text>
        </View>
      )}

      {/* Filter Subject Chips (if requests available) */}
      {requests.length > 0 && (
        <View style={styles.filterRail}>
          {uniqueSubjects.map((sub) => {
            const isSelected = selectedSubject === sub;
            return (
              <Pressable
                key={sub}
                onPress={() => setSelectedSubject(sub)}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <LoadingState message="Listening for live incoming tutor offers..." />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="No Pending Offers"
          description={
            isOnline
              ? 'You are online and in the dispatch pool. When students request help in your subjects, offers will pop up here instantly.'
              : 'Switch your status to Online from the Dashboard to receive real-time tutoring offers.'
          }
        />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const offerExpiresAtMs = normalizeOfferExpiresAt(item.offerExpiresAt);
            const secondsLeft = offerExpiresAtMs
              ? Math.max(0, Math.ceil((offerExpiresAtMs - now) / 1000))
              : 0;
            const pricing = item.pricingSnapshot || {};
            const requestedDuration = Number(
              item.durationMinutes || pricing.requestedDurationMinutes || pricing.durationMinutes || 10
            );
            const isInPerson = item.mode === 'in_person';
            const travelDistanceKm = Number(item.travelDistanceKm || item.distanceKm || 0);
            const payoutInfo = calculateTutorOfferPayout({
              pricingSnapshot: pricing,
              durationMinutes: requestedDuration,
              mode: item.mode,
              travelDistanceKm,
            });
            const meetingLocation = item.meetingAddress || item.studentAddress || item.locationAddress || '';
            const safety = extractSafetySnapshot(item);

            return (
              <Card style={styles.requestCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.badgesRow}>
                    <Badge variant="emerald">{item.subject || 'Mathematics'}</Badge>
                    <Badge variant={isInPerson ? 'amber' : 'sky'}>
                      {isInPerson ? '📍 In-Person' : '💻 Online'}
                    </Badge>
                    {isInPerson && travelDistanceKm > 0 ? (
                      <Badge variant="zinc">🚗 {travelDistanceKm.toFixed(1)} km</Badge>
                    ) : null}
                    {safety.isMinor ? (
                      <Badge variant="amber">🛡️ Minor</Badge>
                    ) : null}
                    {safety.guardianPresenceRequired ? (
                      <Badge variant="violet">👥 Guardian</Badge>
                    ) : null}
                    {safety.preferPublicMeetingPlace ? (
                      <Badge variant="sky">🏢 Public</Badge>
                    ) : null}
                  </View>
                  <Text style={styles.timerBadgeText}>
                    ⏱ {secondsLeft > 0 ? `${secondsLeft}s remaining` : 'Expiring'}
                  </Text>
                </View>

                {isInPerson && (safety.isMinor || safety.guardianPresenceRequired) ? (
                  <View style={styles.safetyReminderBox}>
                    <Ionicons name="shield-checkmark" size={13} color="#b45309" />
                    <Text style={styles.safetyReminderText}>
                      Guardian presence required for minor learner.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.cardTopic}>{item.topic || 'Class Tutoring Offer'}</Text>
                {item.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.studentInfoRow}>
                  <Text style={styles.studentMetaText}>
                    Student: <Text style={styles.bold}>{item.studentName || 'Student'}</Text>
                    {item.grade ? ` • ${item.grade}` : ''}
                  </Text>
                  <Text style={styles.durationBadge}>{requestedDuration} Mins</Text>
                </View>

                {/* Earnings & Address Preview */}
                <View style={styles.payoutRow}>
                  <View>
                    <Text style={styles.payoutLabel}>Est. Payout</Text>
                    <Text style={styles.payoutValue}>R{payoutInfo.totalTutorEarnings.toFixed(2)}</Text>
                  </View>
                  {isInPerson && payoutInfo.travelFee > 0 ? (
                    <Text style={styles.payoutSubtext}>
                      incl. R{payoutInfo.travelFee.toFixed(2)} travel
                    </Text>
                  ) : (
                    <Text style={styles.payoutSubtext}>73% lesson share</Text>
                  )}
                </View>

                {isInPerson && meetingLocation ? (
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    📍 {meetingLocation}
                  </Text>
                ) : null}

                <View style={styles.cardActionsRow}>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleDeclineOffer(item)}
                    style={styles.declineButton}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => handleAcceptOffer(item)}
                    style={styles.acceptButton}
                  >
                    Accept Offer
                  </Button>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Auto Popup Offer Modal */}
      <OfferCountdownModal
        visible={Boolean(activeModalRequest)}
        request={activeModalRequest}
        onAccept={() => handleAcceptOffer(activeModalRequest)}
        onDecline={() => handleDeclineOffer(activeModalRequest)}
        loading={isProcessing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberLight,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  filterRail: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipSelected: {
    backgroundColor: colors.brandLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextSelected: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  requestCard: {
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.amber,
  },
  cardTopic: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  studentMetaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  durationBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  payoutLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#14532d',
  },
  payoutSubtext: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
  },
  cardAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 1.5,
  },
  safetyReminderBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  safetyReminderText: {
    color: '#92400e',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
