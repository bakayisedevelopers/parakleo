import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRequestById, cancelClassRequest } from '../../services/classRequestService';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { getUserProfile } from '../../services/userService';
import { colors } from '../../theme/colors';
import {
  getRequestLifecycleLabel,
  getRequestStatusMeta,
  isRequestJoinable,
  TERMINAL_REQUEST_STATUSES,
} from '../../utils/requestStatus';

function buildTimeline(status, statusDetail) {
  const normalized = String(status || '').toLowerCase();
  const terminal = TERMINAL_REQUEST_STATUSES.includes(normalized);
  const completed = normalized === 'completed';

  return [
    {
      key: 'submitted',
      title: 'Request made',
      description: 'Your lesson request is saved and ready for matching.',
      state: 'done',
    },
    {
      key: 'searching',
      title: 'Searching for tutor',
      description: 'Claxi is matching your request with an available tutor.',
      state: ['pending', 'matching'].includes(normalized)
        ? 'current'
        : ['offered', 'accepted', 'waiting_student', 'in_progress', 'in_session', 'completed', 'no_tutor_available'].includes(normalized)
          ? 'done'
          : terminal
            ? 'done'
            : 'pending',
    },
    {
      key: 'tutor',
      title: normalized === 'offered' ? 'Waiting for tutor to accept' : 'Tutor found',
      description: normalized === 'offered'
        ? 'A tutor was found and is deciding whether to accept.'
        : 'Once accepted, your session entry becomes available.',
      state: normalized === 'offered'
        ? 'current'
        : ['accepted', 'waiting_student', 'in_progress', 'in_session', 'completed'].includes(normalized)
          ? 'done'
          : normalized === 'no_tutor_available'
            ? 'failed'
            : 'pending',
    },
    {
      key: 'ready',
      title: completed ? 'Class completed' : terminal ? 'Request closed' : 'Class ready',
      description: statusDetail || 'Tutor matching, class readiness, and closure updates appear here.',
      state: completed || terminal
        ? 'current'
        : ['accepted', 'waiting_student', 'in_progress', 'in_session'].includes(normalized)
          ? 'current'
          : 'pending',
    },
  ];
}

function getStepPalette(state) {
  if (state === 'done') {
    return {
      backgroundColor: '#d1fae5',
      borderColor: '#a7f3d0',
      titleColor: colors.brandDark,
      copyColor: colors.brandDark,
      markerColor: colors.brand,
    };
  }

  if (state === 'current') {
    return {
      backgroundColor: '#eef2ff',
      borderColor: '#c7d2fe',
      titleColor: colors.indigo,
      copyColor: colors.text,
      markerColor: colors.indigo,
    };
  }

  if (state === 'failed') {
    return {
      backgroundColor: '#fee2e2',
      borderColor: '#fecaca',
      titleColor: colors.danger,
      copyColor: colors.danger,
      markerColor: colors.danger,
    };
  }

  return {
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    titleColor: colors.text,
    copyColor: colors.muted,
    markerColor: '#d4d4d8',
  };
}

export function RequestStatusScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const requestId = route?.params?.requestId || '';
  const [request, setRequest] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [offeredTutorProfile, setOfferedTutorProfile] = useState(null);

  useEffect(() => subscribeToRequestById(
    requestId,
    (item) => {
      setRequest(item);
      setLoading(false);
    },
    (nextError) => {
      setError(nextError.message || 'Unable to load this request right now.');
      setLoading(false);
    },
  ), [requestId]);

  useEffect(() => subscribeToStudentSessions(
    user?.uid,
    (items) => setSessions(items),
    () => setSessions([]),
  ), [user?.uid]);

  useEffect(() => {
    const offeredTutorId = request?.status === 'offered'
      ? (request?.currentOfferTutorId || request?.tutorId || '')
      : '';

    if (!offeredTutorId) {
      setOfferedTutorProfile(null);
      return undefined;
    }

    let isMounted = true;
    getUserProfile(offeredTutorId)
      .then((profile) => {
        if (isMounted) {
          setOfferedTutorProfile(profile || null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOfferedTutorProfile(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [request?.currentOfferTutorId, request?.status, request?.tutorId]);

  const relatedSession = useMemo(
    () => sessions.find((item) => item.requestId === requestId) || null,
    [requestId, sessions],
  );

  if (loading) {
    return <LoadingState label="Loading request status" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!request) {
    return <ErrorState title="Request not found" message="We could not find this class request." />;
  }

  const statusMeta = getRequestStatusMeta(request.status);
  const lifecycleLabel = getRequestLifecycleLabel(request.status);
  const timeline = buildTimeline(request.status, request.statusDetail);
  const canJoin = isRequestJoinable(request.status) && Boolean(relatedSession?.id);
  const canCancel = !TERMINAL_REQUEST_STATUSES.includes(String(request.status || '').toLowerCase());
  const quoteOriginal = request.pricingSnapshot?.originalPrice ?? request.pricingSnapshot?.totalAmount ?? 0;
  const quoteFinal = request.pricingSnapshot?.finalPrice ?? request.pricingSnapshot?.totalAmount ?? 0;
  const tutorRating = Number(
    offeredTutorProfile?.tutorProfile?.overallRating
    ?? offeredTutorProfile?.ratings?.asTutor?.average
    ?? 0,
  );

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      return;
    }

    setIsCanceling(true);
    try {
      await cancelClassRequest({
        requestId,
        canceledBy: 'student',
        reason: cancelReason,
      });
      setShowCancelModal(false);
      setCancelReason('');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Card style={styles.heroCard}>
        <Text style={styles.kicker}>Live request update</Text>
        <Text style={styles.heroTitle}>{lifecycleLabel}</Text>
        <Text style={styles.heroCopy}>
          Request made, tutor search, and class readiness updates appear here in real time.
        </Text>
        <View style={styles.heroMetaRow}>
          <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
          <Text style={styles.heroMetaText}>{request.topic || request.subject || 'Class request'}</Text>
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Request overview</Text>
        <View style={styles.overviewGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Topic</Text>
            <Text style={styles.metricValue}>{request.topic || 'Lesson request'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{request.duration || 'Per-minute billing'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Payment method</Text>
            <Text style={styles.metricValue}>{request.selectedCardId || 'Selected card on file'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Quote</Text>
            <Text style={styles.metricValue}>R{Number(quoteOriginal || 0).toFixed(2)} -> Pay R{Number(quoteFinal || 0).toFixed(2)}</Text>
          </View>
        </View>

        {request?.statusDetail ? (
          <View style={styles.detailBanner}>
            <Text style={styles.detailBannerText}>{request.statusDetail}</Text>
          </View>
        ) : null}

        {request.status === 'offered' ? (
          <View style={styles.offerCard}>
            <Text style={styles.offerTitle}>Waiting for tutor to accept</Text>
            <Text style={styles.offerCopy}>
              Tutor: {request.tutorName || offeredTutorProfile?.fullName || offeredTutorProfile?.displayName || 'Tutor'}
            </Text>
            <Text style={styles.offerCopy}>
              Rating: {tutorRating > 0 ? tutorRating.toFixed(2) : 'Not rated yet'}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Status tracker</Text>
        <View style={styles.timelineList}>
          {timeline.map((step) => {
            const palette = getStepPalette(step.state);
            return (
              <View
                key={step.key}
                style={[
                  styles.timelineStep,
                  {
                    backgroundColor: palette.backgroundColor,
                    borderColor: palette.borderColor,
                  },
                ]}
              >
                <View style={[styles.timelineMarker, { backgroundColor: palette.markerColor }]} />
                <View style={styles.timelineCopy}>
                  <Text style={[styles.timelineTitle, { color: palette.titleColor }]}>{step.title}</Text>
                  <Text style={[styles.timelineDescription, { color: palette.copyColor }]}>{step.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actions}>
          {canJoin ? (
            <Button onPress={() => navigate({ key: 'SessionRoom', params: { sessionId: relatedSession.id, parentTab: 'Sessions' } })}>
              Join / Re-open class
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onPress={() => navigate({ key: 'RequestDetails', params: { requestId, parentTab: 'Requests' } })}
          >
            View full request details
          </Button>
          {canCancel ? (
            <Button variant="secondary" onPress={() => setShowCancelModal(true)}>
              Cancel request
            </Button>
          ) : null}
          <Button variant="secondary" onPress={() => goBack('Requests')}>
            Back to My Classes
          </Button>
        </View>
      </Card>

      <Modal animationType="fade" transparent visible={showCancelModal} onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel request</Text>
            <Text style={styles.modalCopy}>
              Please provide a reason. This helps us improve matching quality.
            </Text>
            <FormField
              label="Reason"
              multiline
              numberOfLines={4}
              placeholder="Type your cancellation reason"
              value={cancelReason}
              onChangeText={setCancelReason}
              inputStyle={styles.reasonInput}
            />
            <View style={styles.modalActions}>
              <Button variant="secondary" onPress={() => setShowCancelModal(false)}>Close</Button>
              <Button disabled={!cancelReason.trim() || isCanceling} onPress={handleCancel}>
                {isCanceling ? 'Canceling...' : 'Confirm cancel'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#ecfdf5',
    gap: 10,
  },
  kicker: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  heroMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetaText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionCard: {
    gap: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  overviewGrid: {
    gap: 10,
  },
  metric: {
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  detailBanner: {
    backgroundColor: '#f4f4f5',
    borderRadius: 18,
    padding: 14,
  },
  detailBannerText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  offerCard: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  offerTitle: {
    color: colors.indigo,
    fontSize: 15,
    fontWeight: '900',
  },
  offerCopy: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineList: {
    gap: 10,
  },
  timelineStep: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  timelineMarker: {
    borderRadius: 999,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  timelineCopy: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  timelineDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    width: '100%',
    maxWidth: 440,
    gap: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonInput: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  modalActions: {
    gap: 10,
  },
});
