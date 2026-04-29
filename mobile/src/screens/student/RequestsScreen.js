import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentRequests } from '../../services/classRequestService';
import { colors } from '../../theme/colors';
import { formatRand } from '../../utils/pricing';
import { getRequestStatusMeta } from '../../utils/requestStatus';

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
  if (!requests.length) return <EmptyState title="No requests yet" message="Create a class request from the dashboard to see it here." />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Classes</Text>
      {requests.map((request) => (
        <Card key={request.id} style={styles.card}>
          <StatusBadge {...getRequestStatusMeta(request.status)} />
          <Text style={styles.cardTitle}>{request.topic || request.subject || 'Class request'}</Text>
          <Text style={styles.copy}>{request.description || 'No description added.'}</Text>
          <Text style={styles.meta}>Subject: {request.subject || 'Mathematics'} | Duration: {request.durationMinutes || 10} min</Text>
          {request.pricingSnapshot?.totalAmount ? (
            <Text style={styles.meta}>
              Quote: {formatRand(request.pricingSnapshot.originalPrice ?? request.pricingSnapshot.totalAmount)} | Pay {formatRand(request.pricingSnapshot.finalPrice ?? request.pricingSnapshot.totalAmount)}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            Attachments: {Array.isArray(request.attachments) ? request.attachments.length : (request.attachment ? 1 : 0)}
          </Text>
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
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
