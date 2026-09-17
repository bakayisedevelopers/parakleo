import { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { useTutorSessions } from '../../hooks/useSessions';
import { colors } from '../../theme/colors';

export function TutorMetricsScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const { sessions } = useTutorSessions(user?.uid);

  const tutorProfile = user?.tutorProfile || {};

  const completedSessionsCount = useMemo(() => {
    return sessions?.filter((s) => s.status === 'completed')?.length ||
      Number(tutorProfile.completedSessionsCount ?? user?.completedSessionsCount ?? 0);
  }, [sessions, tutorProfile.completedSessionsCount, user?.completedSessionsCount]);

  const rating = Number(tutorProfile.overallRating ?? user?.overallRating ?? 5.0);
  const acceptanceRate = Number(tutorProfile.acceptanceRate ?? user?.acceptanceRate ?? 100);
  const completionRate = Number(tutorProfile.completionRate ?? user?.completionRate ?? 100);
  const avgResponseSeconds = Number(tutorProfile.avgResponseSeconds ?? user?.avgResponseSeconds ?? 15);
  const cancellationRate = Number(tutorProfile.cancellationRate ?? user?.cancellationRate ?? 0);

  return (
    <View style={styles.safeArea}>
      <Header
        title="Tutor Stats & Metrics"
        subtitle="Track your teaching ratings and performance"
        onBack={goBack}
        backIconName="chevron-back"
        transparentBackButton
        rightElement={
          <Pressable
            onPress={() => navigate('Notifications')}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="notifications-outline" size={20} color="#18181b" />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Rating Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroScoreContainer}>
            <Text style={styles.heroScoreText}>{rating.toFixed(1)}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={`hero-star-${star}`}
                  name="star"
                  size={20}
                  color="#f59e0b"
                  style={styles.starIcon}
                />
              ))}
            </View>
            <Text style={styles.heroSubText}>Overall Tutor Rating</Text>
            <Badge variant="emerald" style={styles.standingBadge}>
              Top Performer
            </Badge>
          </View>
        </Card>

        {/* Key Metrics Grid */}
        <Text style={styles.sectionHeading}>Performance Breakdown</Text>
        <View style={styles.gridContainer}>
          <Card style={styles.gridTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.brandDark} />
              <Text style={styles.tileValue}>{Math.round(acceptanceRate)}%</Text>
            </View>
            <Text style={styles.tileLabel}>Acceptance Rate</Text>
            <Text style={styles.tileSub}>Offers accepted</Text>
          </Card>

          <Card style={styles.gridTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="ribbon-outline" size={20} color="#059669" />
              <Text style={styles.tileValue}>{Math.round(completionRate)}%</Text>
            </View>
            <Text style={styles.tileLabel}>Completion Rate</Text>
            <Text style={styles.tileSub}>Sessions fulfilled</Text>
          </Card>

          <Card style={styles.gridTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="stopwatch-outline" size={20} color="#0284c7" />
              <Text style={styles.tileValue}>{avgResponseSeconds}s</Text>
            </View>
            <Text style={styles.tileLabel}>Response Time</Text>
            <Text style={styles.tileSub}>Average offer accept</Text>
          </Card>

          <Card style={styles.gridTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="school-outline" size={20} color="#7c3aed" />
              <Text style={styles.tileValue}>{completedSessionsCount}</Text>
            </View>
            <Text style={styles.tileLabel}>Completed Classes</Text>
            <Text style={styles.tileSub}>All-time lessons</Text>
          </Card>
        </View>

        {/* Quality Guidelines Card */}
        <Card style={styles.guidelinesCard}>
          <View style={styles.guidelinesHeader}>
            <Ionicons name="bulb-outline" size={22} color={colors.brandDark} />
            <Text style={styles.guidelinesTitle}>How Dispatch Matching Works</Text>
          </View>
          <Text style={styles.guidelinesBody}>
            Parakleo automatically dispatches student requests to top-rated tutors with high acceptance rates and rapid response times. Keep your online dial active during peak study hours to receive priority lesson offers.
          </Text>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-sharp" size={16} color={colors.brandDark} />
              <Text style={styles.tipText}>Respond to instant class offers within 30 seconds.</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-sharp" size={16} color={colors.brandDark} />
              <Text style={styles.tipText}>Maintain high attendance and punctuality in live rooms.</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-sharp" size={16} color={colors.brandDark} />
              <Text style={styles.tipText}>Upload verified qualifications to expand eligible subjects.</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#ffffff',
  },
  heroScoreContainer: {
    alignItems: 'center',
  },
  heroScoreText: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  heroSubText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  standingBadge: {
    marginTop: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  gridTile: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  tileSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  guidelinesCard: {
    padding: 18,
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  guidelinesBody: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 14,
  },
  tipsList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
});
