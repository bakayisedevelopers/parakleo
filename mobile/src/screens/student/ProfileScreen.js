import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function ProfileScreen({ navigate }) {
  const { logout, user } = useAuth();
  const onboardingStatus = getStudentOnboardingStatus(user);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Profile</Text>
      <Card style={styles.card}>
        <StatusBadge label={onboardingStatus.complete ? 'Onboarding complete' : 'Onboarding pending'} tone={onboardingStatus.complete ? 'success' : 'warning'} />
        <Text style={styles.name}>{user?.fullName || user?.displayName || 'Student'}</Text>
        <Text style={styles.copy}>{user?.email}</Text>
        <Text style={styles.copy}>Role: student</Text>
      </Card>
      <Button onPress={() => navigate('Onboarding')}>Complete Profile</Button>
      <Button variant="secondary" onPress={logout}>Sign out</Button>
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
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
  },
});
