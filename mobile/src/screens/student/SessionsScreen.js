import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { colors } from '../../theme/colors';

export function SessionsScreen() {
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
      <Text style={styles.title}>Classes</Text>
      {sessions.map((session) => (
        <Card key={session.id} style={styles.card}>
          <StatusBadge label={session.status || 'scheduled'} tone="info" />
          <Text style={styles.cardTitle}>{session.subject || 'Class session'}</Text>
          <Text style={styles.copy}>Tutor: {session.tutorName || session.tutorId || 'Pending'}</Text>
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
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
  },
});
