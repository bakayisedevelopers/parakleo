import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';

export function ClassQueueCard({ request, session, onOpenSession, onCancelSession }) {
  const isInPerson = request?.mode === 'in_person'
    || session?.mode === 'in_person'
    || Boolean(request?.studentLocation || session?.destination);
  const isLive = session?.status === 'in_progress' || request?.status === 'in_session';
  const isReady = session?.status === 'waiting_student';

  return (
    <Card style={[styles.card, isLive && styles.liveCard]}>
      {/* Header Badges */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <Badge variant="emerald">{request.subject || 'Mathematics'}</Badge>
          <Badge variant={request.mode === 'in_person' ? 'amber' : 'sky'}>
            {request.mode === 'in_person' ? '📍 In-Person' : '💻 Online Live'}
          </Badge>
        </View>
        <Badge variant={isLive ? 'emerald' : isReady ? 'sky' : 'zinc'}>
          {isLive ? 'In Progress' : isReady ? 'Ready to Join' : (request.status || 'Accepted')}
        </Badge>
      </View>

      {/* Topic & Description */}
      <Text style={styles.topicText}>{request.topic || 'Tutoring Class'}</Text>
      {request.description ? (
        <Text style={styles.descText} numberOfLines={2}>
          {request.description}
        </Text>
      ) : null}

      {/* Student & Class Details */}
      <View style={styles.infoRow}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={15} color={colors.textMuted} />
          <Text style={styles.metaText}>{request.studentName || 'Student'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {session?.duration || `${request.durationMinutes || 10} Mins`}
          </Text>
        </View>
        {request.pricingSnapshot?.finalPrice ? (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText}>R{Number(request.pricingSnapshot.finalPrice).toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      {/* Session Linked Banner */}
      {session ? (
        <View style={[styles.sessionBanner, isLive && styles.sessionBannerLive]}>
          <Ionicons
            name={isLive ? 'radio' : 'link-outline'}
            size={16}
            color={isLive ? '#059669' : colors.brandDark}
          />
          <Text style={[styles.sessionBannerText, isLive && styles.sessionBannerTextLive]}>
            {isLive
              ? 'Class is live right now! Rejoin to continue teaching.'
              : `Session room active • Status: ${session.status || 'waiting'}`}
          </Text>
        </View>
      ) : null}

      {/* Open Session / Navigation CTA */}
      <View style={styles.actionsWrap}>
        {session?.id || isInPerson ? (
          <Pressable
            onPress={() => onOpenSession?.(session?.id, request)}
            style={styles.openButton}
          >
            <Text style={styles.openButtonText}>
              {isInPerson
                ? 'Open Navigation Map'
                : (isLive ? 'Enter Live Session Room' : 'Open Class Session')}
            </Text>
            <Ionicons
              name={isInPerson ? 'navigate' : 'arrow-forward'}
              size={16}
              color="#ffffff"
            />
          </Pressable>
        ) : null}

        {onCancelSession ? (
          <Pressable
            onPress={() => onCancelSession?.(request?.id, session?.id)}
            style={styles.cancelButton}
          >
            <Ionicons name="close-circle-outline" size={15} color="#e11d48" />
            <Text style={styles.cancelButtonText}>Cancel Class</Text>
          </Pressable>
        ) : null}
      </View>
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
  liveCard: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ffffff',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
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
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  sessionBannerLive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  sessionBannerText: {
    fontSize: 12,
    color: colors.brandDark,
    fontWeight: '600',
    flex: 1,
  },
  sessionBannerTextLive: {
    color: '#047857',
    fontWeight: '700',
  },
  actionsWrap: {
    gap: 8,
  },
  openButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  openButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090b',
  },
  cancelButton: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
  },
});
