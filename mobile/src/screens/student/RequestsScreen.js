import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentRequests } from '../../services/classRequestService';
import { colors } from '../../theme/colors';

export function RequestsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <LoadingState label="Loading requests" />;
  if (error) return <ErrorState message={error} />;
  if (!requests.length) return <EmptyState title="No requests yet" message="Phase 3 will add request creation here." />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Classes</Text>
      {requests.map((request) => (
        <Card key={request.id} style={styles.card}>
          <StatusBadge label={request.status || 'pending'} />
          <Text style={styles.cardTitle}>{request.topic || request.subject || 'Class request'}</Text>
          <Text style={styles.copy}>{request.description || 'No description added.'}</Text>
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
