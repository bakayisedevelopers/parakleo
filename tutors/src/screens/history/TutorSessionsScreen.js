import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Header } from '../../components/ui/Header';
import { RatingsSummaryCard } from '../../components/history/RatingsSummaryCard';
import { SessionHistoryCard } from '../../components/history/SessionHistoryCard';
import { useAuth } from '../../context/AuthContext';
import { useTutorSessions } from '../../hooks/useSessions';
import { colors } from '../../theme/colors';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function TutorSessionsScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const { sessions, isLoading } = useTutorSessions(user?.uid);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const tutorProfile = user?.tutorProfile || {};

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const norm = String(session.status || '').toLowerCase();
      const isCancelled = [
        'canceled',
        'canceled_during',
        'canceled_by_tutor',
        'canceled_by_student',
        'cancelled',
        'closed',
        'expired',
      ].includes(norm) || Boolean(session.canceledAt || session.canceledBy);
      const isCompleted = ['completed', 'settled'].includes(norm);
      const isInProgress = ['in_progress', 'in_session', 'arrived', 'waiting_student', 'preparing_for_lesson', 'travelling', 'traveling', 'accepted'].includes(norm);

      // Status filter
      if (selectedStatus === 'completed' && !isCompleted) return false;
      if (selectedStatus === 'cancelled' && !isCancelled) return false;
      if (selectedStatus === 'in_progress' && !isInProgress) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const topic = (session.topic || '').toLowerCase();
        const subject = (session.subject || '').toLowerCase();
        const student = (session.studentName || '').toLowerCase();
        return topic.includes(query) || subject.includes(query) || student.includes(query);
      }
      return true;
    });
  }, [sessions, selectedStatus, searchQuery]);

  const completedCount = useMemo(() => {
    return sessions.filter((s) => ['completed', 'settled'].includes(String(s.status || '').toLowerCase())).length;
  }, [sessions]);

  const handleOpenSession = (session) => {
    if (!session) return;
    const sessionId = typeof session === 'string' ? session : session?.id;
    const requestId = typeof session === 'object' ? (session?.requestId || session?.id) : sessionId;
    const requestData = typeof session === 'object' ? session : null;

    if (typeof navigate === 'function') {
      navigate('RequestDetails', {
        requestId,
        sessionId,
        request: requestData,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Session History"
        subtitle="Completed lessons and feedback"
        onBack={() => {
          if (goBack) goBack();
          else if (navigate) navigate('Dashboard');
        }}
        backIconName="chevron-back"
        transparentBackButton
        rightElement={
          <Pressable
            onPress={() => navigate('Notifications')}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={20} color="#18181b" />
          </Pressable>
        }
      />

      {/* Filter Rail */}
      <View style={styles.filterRail}>
        {STATUS_FILTERS.map((tab) => {
          const isSelected = selectedStatus === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setSelectedStatus(tab.id)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by subject, topic or student..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <LoadingState message="Syncing session records..." />
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={
            <RatingsSummaryCard
              rating={tutorProfile.overallRating || user?.overallRating || 5.0}
              totalSessions={completedCount}
              completionRate={tutorProfile.completionRate || user?.completionRate || 100}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No Sessions Found"
              description={
                searchQuery
                  ? 'No sessions match your search terms.'
                  : 'Complete your first class to see your teaching history and ratings here.'
              }
            />
          }
          renderItem={({ item }) => (
            <SessionHistoryCard session={item} onOpenSession={handleOpenSession} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterRail: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipSelected: {
    backgroundColor: colors.brandLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextSelected: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
});
