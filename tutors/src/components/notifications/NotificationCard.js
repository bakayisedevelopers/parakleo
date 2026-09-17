import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';

function getNotificationIcon(type) {
  switch (String(type).toLowerCase()) {
    case 'offer':
    case 'class_request':
      return { name: 'flash-outline', color: colors.amber, bg: colors.amberLight };
    case 'session':
    case 'session_ready':
      return { name: 'videocam-outline', color: colors.brandDark, bg: colors.brandLight };
    case 'payment':
    case 'payout':
      return { name: 'wallet-outline', color: '#16a34a', bg: '#f0fdf4' };
    case 'agreement':
      return { name: 'document-text-outline', color: colors.sky, bg: colors.skyLight };
    default:
      return { name: 'notifications-outline', color: colors.text, bg: colors.surfaceMuted };
  }
}

export function NotificationCard({ notification, onSelect, onDelete }) {
  const iconConfig = getNotificationIcon(notification.type);
  const isRead = Boolean(notification.read);

  const createdAt = notification.createdAt;
  const timeFormatted = createdAt
    ? new Date(typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : createdAt).toLocaleDateString()
    : 'Recent';

  return (
    <Pressable onPress={() => onSelect(notification)}>
      <Card style={[styles.card, !isRead && styles.unreadCard]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconCircle, { backgroundColor: iconConfig.bg }]}>
            <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
          </View>

          <View style={styles.textCol}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, !isRead && styles.unreadTitle]} numberOfLines={1}>
                {notification.title || 'Notification'}
              </Text>
              <Text style={styles.timeText}>{timeFormatted}</Text>
            </View>

            <Text style={styles.message} numberOfLines={2}>
              {notification.message || notification.body || ''}
            </Text>
          </View>

          {!isRead && <View style={styles.unreadDot} />}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadCard: {
    backgroundColor: '#fbfefe',
    borderColor: '#bbf7d0',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '900',
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  message: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginLeft: 8,
  },
});
