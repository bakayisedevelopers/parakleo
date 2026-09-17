import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';

export function RatingsSummaryCard({ rating = 5.0, totalSessions = 0, completionRate = 100 }) {
  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{Number(rating || 5.0).toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={`star-${star}`}
                name="star"
                size={16}
                color="#f59e0b"
                style={styles.starIcon}
              />
            ))}
          </View>
          <Text style={styles.reviewCountText}>Overall Tutor Rating</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Completed Classes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.round(completionRate)}%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceMuted,
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  starIcon: {
    marginHorizontal: 1,
  },
  reviewCountText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statsContainer: {
    flex: 1,
    paddingLeft: 20,
    gap: 12,
  },
  statBox: {},
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
