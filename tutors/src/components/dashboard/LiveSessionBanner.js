import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';

export function LiveSessionBanner({
  session,
  request,
  onJoin,
  onCancel,
  isCanceling = false,
}) {
  if (!session && !request) return null;

  const activeItem = session || request;
  const isInPerson = session?.mode === 'in_person'
    || request?.mode === 'in_person'
    || Boolean(request?.destination || session?.destination || request?.studentLocation);

  const isInProgress = activeItem?.status === 'in_progress'
    || activeItem?.status === 'in_session'
    || session?.status === 'in_progress'
    || request?.status === 'in_session';

  const studentName = request?.studentName || session?.studentName || 'Student';
  const topic = request?.topic || session?.topic || request?.subject || session?.subject || 'Active Tutoring Class';
  const studentAddress = request?.studentAddress || request?.locationAddress || session?.studentAddress || '';
  const durationText = session?.duration
    || request?.duration
    || `${session?.durationMinutes || request?.durationMinutes || 15} Mins`;

  return (
    <Card style={[styles.bannerCard, isInPerson && styles.inPersonCard]}>
      <View style={styles.topRow}>
        <Badge variant={isInPerson ? 'amber' : 'sky'}>
          {isInPerson
            ? (isInProgress ? 'In-Person Class • In Progress' : '📍 In-Person • Traveling')
            : (isInProgress ? 'Live Session • In Progress' : 'Ready to Join')}
        </Badge>
        <View style={[styles.livePulseDot, isInPerson && styles.inPersonPulseDot]} />
      </View>

      <Text style={styles.title}>
        {isInPerson
          ? (isInProgress ? 'Your in-person class is in progress.' : 'Travel to student location.')
          : (isInProgress ? 'Your class is in progress.' : 'Your class is ready to join.')}
      </Text>

      <Text style={styles.subtitle}>
        {topic} • Student: {studentName}
        {studentAddress ? `\n📍 ${studentAddress}` : ''}
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>{studentName}</Text>
        <Text style={styles.infoDuration}>{durationText}</Text>
        <Text style={styles.infoHelper}>
          {isInPerson
            ? 'Follow live turn-by-turn navigation and live student tracking to the destination.'
            : (isInProgress
                ? 'Rejoin the live virtual classroom from any device.'
                : 'Open the session room to meet your student and begin.')}
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          onPress={onJoin}
          disabled={isCanceling}
          style={({ pressed }) => [
            styles.joinButton,
            pressed && { opacity: 0.85 },
            isCanceling && styles.disabledButton,
          ]}
        >
          <Text style={styles.joinButtonText}>
            {isInPerson ? 'Open Navigation Map' : 'Join Session Room'}
          </Text>
          <Ionicons
            name={isInPerson ? 'navigate' : 'arrow-forward'}
            size={18}
            color="#09090b"
          />
        </Pressable>

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={isCanceling}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && { opacity: 0.75 },
              isCanceling && styles.disabledButton,
            ]}
          >
            {isCanceling ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={17} color="#e11d48" />
                <Text style={styles.cancelButtonText}>Cancel Session / Request</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    backgroundColor: '#ffffff',
    borderColor: '#bae6fd',
    borderWidth: 1.5,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  inPersonCard: {
    borderColor: '#bbf7d0',
    shadowColor: '#059669',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  inPersonPulseDot: {
    backgroundColor: '#059669',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoDuration: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  infoHelper: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  actionsContainer: {
    gap: 10,
  },
  joinButton: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090b',
  },
  cancelButton: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e11d48',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
