import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/States';
import { StudentRequestComposer } from '../../components/student/StudentRequestComposer';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentRequests } from '../../services/classRequestService';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function DashboardScreen({ navigate }) {
  const { user } = useAuth();
  const onboardingStatus = getStudentOnboardingStatus(user);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => subscribeToStudentRequests(
    user?.uid,
    (items) => {
      setRequests(items);
      setLoadingRequests(false);
    },
    () => setLoadingRequests(false),
  ), [user?.uid]);

  useEffect(() => subscribeToStudentSessions(
    user?.uid,
    (items) => {
      setSessions(items);
      setLoadingSessions(false);
    },
    () => setLoadingSessions(false),
  ), [user?.uid]);

  if (loadingRequests || loadingSessions) {
    return <LoadingState label="Loading dashboard" />;
  }

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.kicker}>Student dashboard</Text>
        <Text style={styles.title}>Hi {user?.displayName || 'there'}</Text>
      </View>
      <StudentRequestComposer navigate={navigate} requests={requests} sessions={sessions} user={user} />
      <View style={styles.grid}>
        <Card style={styles.tile}>
          <Text style={styles.tileValue}>{user?.freeMinutesRemaining ?? 0}</Text>
          <Text style={styles.tileLabel}>Free minutes</Text>
        </Card>
        <Card style={styles.tile}>
          <Text style={styles.tileValue}>{user?.paymentMethods?.length ?? 0}</Text>
          <Text style={styles.tileLabel}>Saved cards</Text>
        </Card>
      </View>
      {!onboardingStatus.complete ? (
        <Card>
          <Text style={styles.copy}>{onboardingStatus.message}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  kicker: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
  },
  tileValue: {
    color: colors.indigo,
    fontSize: 22,
    fontWeight: '900',
  },
  tileLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
