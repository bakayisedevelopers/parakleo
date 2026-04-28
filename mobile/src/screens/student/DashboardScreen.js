import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function DashboardScreen({ navigate }) {
  const { user } = useAuth();
  const onboardingStatus = getStudentOnboardingStatus(user);

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.kicker}>Student dashboard</Text>
        <Text style={styles.title}>Hi {user?.displayName || 'there'}</Text>
      </View>
      <Card style={styles.hero}>
        <StatusBadge label={onboardingStatus.complete ? 'Ready' : 'Complete profile'} tone={onboardingStatus.complete ? 'success' : 'warning'} />
        <Text style={styles.cardTitle}>Request flow placeholder</Text>
        <Text style={styles.copy}>
          {onboardingStatus.complete
            ? 'The app shell is ready for the Phase 3 dashboard-first request creation flow.'
            : onboardingStatus.message}
        </Text>
        <Button onPress={() => navigate(onboardingStatus.complete ? 'Requests' : 'Onboarding')}>
          {onboardingStatus.complete ? 'View requests' : 'Complete profile'}
        </Button>
      </Card>
      <View style={styles.grid}>
        <Card style={styles.tile}>
          <Text style={styles.tileValue}>{user?.freeMinutesRemaining ?? 0}</Text>
          <Text style={styles.tileLabel}>Free minutes</Text>
        </Card>
        <Card style={styles.tile}>
          <Text style={styles.tileValue}>ZAR</Text>
          <Text style={styles.tileLabel}>Payment currency</Text>
        </Card>
      </View>
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
  hero: {
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
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
