import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { TUTOR_PAYOUT_RATE } from '../../constants/pricing';
import { colors } from '../../theme/colors';

export function SessionHistoryCard({ session, onOpenSession }) {
  const isCompleted = session.status === 'completed';
  const isInProgress = session.status === 'in_progress';
  const isCancelled = session.status === 'cancelled';

  const badgeVariant = isCompleted ? 'emerald' : isInProgress ? 'sky' : isCancelled ? 'rose' : 'zinc';
  const sessionDate = session.createdAt || session.updatedAt;
  const formattedDate = sessionDate
    ? new Date(typeof sessionDate?.toMillis === 'function' ? sessionDate.toMillis() : sessionDate).toLocaleDateString()
    : 'Recent';

  const billedMinutes = Math.max(1, Math.round(Number(session.billedSeconds || 0) / 60));
  const tutorEarnings = Number(session.tutorPayoutAmount || (session.totalAmount ? session.totalAmount * TUTOR_PAYOUT_RATE : 0));

  return (
    <Card style={styles.card}>
      {/* Header Badges */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <Badge variant="emerald">{session.subject || 'Mathematics'}</Badge>
          <Badge variant={session.mode === 'in_person' ? 'amber' : 'sky'}>
            {session.mode === 'in_person' ? '📍 In-Person' : '💻 Online'}
          </Badge>
        </View>
        <Badge variant={badgeVariant}>
          {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : isCancelled ? 'Cancelled' : (session.status || 'Active')}
        </Badge>
      </View>

      {/* Topic & Description */}
      <Text style={styles.topicText}>{session.topic || 'Tutoring Class'}</Text>
      <Text style={styles.metaRowText}>
        {formattedDate} • Student: <Text style={styles.bold}>{session.studentName || 'Student'}</Text>
      </Text>

      {/* Metrics Row (Duration & Earnings) */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={styles.metricText}>
            {isCompleted ? `${billedMinutes} Mins Taught` : session.duration || `${session.durationMinutes || 10} Mins`}
          </Text>
        </View>

        {tutorEarnings > 0 ? (
          <View style={styles.metricItem}>
            <Ionicons name="cash-outline" size={15} color={colors.brandDark} />
            <Text style={[styles.metricText, styles.earningsText]}>
              +R{tutorEarnings.toFixed(2)} Earned
            </Text>
          </View>
        ) : null}
      </View>

      {/* Student Rating & Feedback (if rated) */}
      {session.rating?.score || session.studentRating ? (
        <View style={styles.feedbackBox}>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={`rating-star-${star}`}
                name="star"
                size={14}
                color={star <= Number(session.rating?.score || session.studentRating) ? '#f59e0b' : colors.border}
              />
            ))}
          </View>
          {session.rating?.feedback || session.studentFeedback ? (
            <Text style={styles.feedbackText}>
              "{session.rating?.feedback || session.studentFeedback}"
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Action button */}
      {isInProgress && (
        <Pressable onPress={() => onOpenSession(session.id)} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Rejoin Live Classroom</Text>
          <Ionicons name="arrow-forward" size={15} color="#ffffff" />
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  topicText: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metaRowText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  earningsText: {
    color: colors.brandDark,
    fontWeight: '700',
  },
  feedbackBox: {
    marginTop: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackText: {
    fontSize: 12,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
