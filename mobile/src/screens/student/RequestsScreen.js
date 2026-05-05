import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentRequests } from '../../services/classRequestService';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { colors } from '../../theme/colors';
import { formatRand } from '../../utils/pricing';
import { getRequestLifecycleLabel, getRequestStatusMeta, isRequestJoinable } from '../../utils/requestStatus';

export function RequestsScreen({ navigate }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    return subscribeToStudentRequests(
      user?.uid,
      (items) => {
        setRequests(items);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      },
    );
  }, [user?.uid]);

  useEffect(() => subscribeToStudentSessions(
    user?.uid,
    (items) => {
      setSessions(items);
      setLoadingSessions(false);
    },
    () => {
      setSessions([]);
      setLoadingSessions(false);
    },
  ), [user?.uid]);

  const sessionByRequestId = useMemo(
    () => new Map(sessions.map((session) => [session.requestId, session])),
    [sessions],
  );

  if (loading || loadingSessions) return <LoadingState label="Loading requests" />;
  if (error) return <ErrorState message={error} />;
  if (!requests.length) return <EmptyState title="No requests yet" message="Create a class request from the dashboard to see it here." />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>My Classes</Text>
      {requests.map((request) => (
        <Card key={request.id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate({ key: 'RequestStatus', params: { requestId: request.id, parentTab: 'Requests' } })}
            style={styles.cardPressable}
          >
            <StatusBadge {...getRequestStatusMeta(request.status)} />
            <Text style={styles.cardTitle}>{request.topic || request.subject || 'Class request'}</Text>
            <Text style={styles.copy}>{request.description || 'No description added.'}</Text>
            <Text style={styles.meta}>{getRequestLifecycleLabel(request.status)}</Text>
            <Text style={styles.meta}>Subject: {request.subject || 'Mathematics'} | Duration: {request.duration || `${request.durationMinutes || 10} minutes`}</Text>
            {request.pricingSnapshot?.totalAmount ? (
              <Text style={styles.meta}>
                Quote: {formatRand(request.pricingSnapshot.originalPrice ?? request.pricingSnapshot.totalAmount)} | Pay {formatRand(request.pricingSnapshot.finalPrice ?? request.pricingSnapshot.totalAmount)}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              Attachments: {Array.isArray(request.attachments) ? request.attachments.length : (request.attachment ? 1 : 0)}
            </Text>
            {sessionByRequestId.get(request.id) ? (
              <Text style={styles.sessionMeta}>
                Session linked: {sessionByRequestId.get(request.id).status || 'waiting_student'} | {sessionByRequestId.get(request.id).duration || request.duration || 'Duration pending'}
              </Text>
            ) : null}
          </Pressable>
          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={() => navigate({ key: 'RequestDetails', params: { requestId: request.id, parentTab: 'Requests' } })}
            >
              View details
            </Button>
            {isRequestJoinable(request.status) && sessionByRequestId.get(request.id)?.id ? (
              <Button onPress={() => navigate({ key: 'SessionRoom', params: { sessionId: sessionByRequestId.get(request.id).id, parentTab: 'Sessions' } })}>
                Join / Re-open class
              </Button>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  card: {
    gap: 10,
  },
  cardPressable: {
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionMeta: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
});
