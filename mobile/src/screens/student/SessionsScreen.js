import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { colors } from '../../theme/colors';
import { formatRand } from '../../utils/pricing';
import { getSessionStatusMeta } from '../../utils/sessionStatus';

export function SessionsScreen({ navigate }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    return subscribeToStudentSessions(
      user?.uid,
      (items) => {
        setSessions(items);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      },
    );
  }, [user?.uid]);

  if (loading) return <LoadingState label="Loading classes" />;
  if (error) return <ErrorState message={error} />;
  if (!sessions.length) return <EmptyState title="No classes yet" message="Accepted requests will appear here." />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sessions</Text>
      {sessions.map((session) => (
        <Card key={session.id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate({ key: 'SessionRoom', params: { sessionId: session.id, parentTab: 'Sessions' } })}
            style={styles.cardPressable}
          >
            <StatusBadge {...getSessionStatusMeta(session.status)} />
            <Text style={styles.cardTitle}>{session.topic || session.subject || 'Class session'}</Text>
            <Text style={styles.copy}>Tutor: {session.tutorName || session.tutorId || 'Pending'}</Text>
            <Text style={styles.meta}>Duration: {session.duration || `${session.durationMinutes || 10} minutes`}</Text>
            <Text style={styles.meta}>Meeting provider: {session.meetingProvider || 'Claxi WebRTC'}</Text>
            {session.pricingSnapshot ? (
              <Text style={styles.meta}>
                Billing snapshot: Base {formatRand(session.pricingSnapshot.adjustedBaseAmount ?? session.pricingSnapshot.baseAmount ?? 0)} | Rate {formatRand(session.pricingSnapshot.adjustedRatePerMinute ?? session.pricingSnapshot.ratePerMinute ?? 0)}
              </Text>
            ) : null}
          </Pressable>
          <Button onPress={() => navigate({ key: 'SessionRoom', params: { sessionId: session.id, parentTab: 'Sessions' } })}>
            {session.status === 'in_progress' ? 'Rejoin Call' : 'Open Session Room'}
          </Button>
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
});
