import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { EmptyState, LoadingState } from '../ui/States';
import { colors } from '../../theme/colors';

function getNotificationActionLabel(notification) {
  const targetPath = String(notification?.targetPath || '');
  const type = String(notification?.type || '').toLowerCase();

  if (targetPath.includes('/payment') || type.includes('payment')) {
    return 'Open payment';
  }

  if (targetPath.includes('/requests') || type === 'lesson_completed' || type === 'session_completed') {
    return 'Open status';
  }

  if (notification?.sessionId) {
    return 'Open session';
  }

  if (notification?.requestId) {
    return 'Open request';
  }

  return '';
}

export function NotificationCenterModal({
  visible,
  notifications,
  isLoading,
  onClose,
  onOpenNotification,
  onOpenRequest,
  onOpenSession,
}) {
  const handleOpen = (notification) => {
    if (onOpenNotification) {
      onOpenNotification(notification);
      return;
    }

    if (notification?.sessionId) {
      onOpenSession?.(notification.sessionId);
      return;
    }

    if (notification?.requestId) {
      onOpenRequest?.(notification.requestId);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Realtime updates</Text>
              <Text style={styles.title}>Notifications</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <LoadingState label="Loading notifications" />
          ) : notifications.length ? (
            <ScrollView contentContainerStyle={styles.list}>
              {notifications.map((notification) => (
                <Pressable
                  accessibilityRole="button"
                  key={notification.id}
                  disabled={!notification?.requestId && !notification?.sessionId && !notification?.targetPath}
                  onPress={() => handleOpen(notification)}
                >
                  <Card style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{notification.title || 'Notification'}</Text>
                      {!notification?.read ? (
                        <View style={styles.unreadPill}>
                          <Text style={styles.unreadLabel}>Unread</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardMessage}>{notification.message || 'Realtime activity appears here.'}</Text>
                    {getNotificationActionLabel(notification) ? (
                      <Text style={styles.actionLabel}>{getNotificationActionLabel(notification)}</Text>
                    ) : null}
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <EmptyState title="No notifications yet" message="Realtime updates appear here." />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kicker: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  closeButton: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    gap: 10,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  unreadPill: {
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unreadLabel: {
    color: colors.brandDark,
    fontSize: 11,
    fontWeight: '800',
  },
  cardMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionLabel: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
