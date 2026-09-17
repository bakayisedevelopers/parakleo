import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Header } from '../../components/ui/Header';
import { NotificationCard } from '../../components/notifications/NotificationCard';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { colors } from '../../theme/colors';

export function NotificationsScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    removeNotification,
  } = useNotifications(user?.uid);

  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, activeFilter]);

  const handleSelectNotification = async (notification) => {
    if (!notification?.read) {
      await markRead(notification.id).catch(() => {});
    }

    // Smart routing based on notification type / payload
    const type = String(notification.type || '').toLowerCase();
    if (type === 'offer' || type === 'class_request' || notification.requestId) {
      navigate('AvailableRequests');
    } else if (type === 'session' || type === 'session_ready' || notification.sessionId) {
      if (notification.sessionId) {
        navigate('SessionRoom', { sessionId: notification.sessionId });
      } else {
        navigate('MyClasses');
      }
    } else if (type === 'payment' || type === 'payout') {
      navigate('Earnings');
    } else if (type === 'agreement') {
      navigate('Agreement');
    }
  };

  return (
    <View style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread update(s)` : 'All caught up'}
        onBack={goBack}
        backIconName="chevron-back"
        transparentBackButton
      />

      {/* Top Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.filterGroup}>
          <Pressable
            onPress={() => setActiveFilter('all')}
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              All ({notifications.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveFilter('unread')}
            style={[styles.filterChip, activeFilter === 'unread' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'unread' && styles.filterTextActive]}>
              Unread ({unreadCount})
            </Text>
          </Pressable>
        </View>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onPress={markAllRead}
            style={styles.markReadButton}
          >
            Mark all read
          </Button>
        )}
      </View>

      {isLoading ? (
        <LoadingState message="Syncing notification inbox..." />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title={activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={
            activeFilter === 'unread'
              ? 'You have read all your alerts and student updates.'
              : 'New match requests, session updates, and weekly payout records will appear here.'
          }
        />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={colors.brand}
            />
          }
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onSelect={handleSelectNotification}
              onDelete={removeNotification}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipActive: {
    backgroundColor: colors.brandLight,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  markReadButton: {
    paddingHorizontal: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
