import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ClassQueueCard } from '../../components/classes/ClassQueueCard';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { useTutorAcceptedRequests } from '../../hooks/useClassRequests';
import { useTutorSessions } from '../../hooks/useSessions';
import { cancelClassRequestAndSession } from '../../services/classRequestService';
import { colors } from '../../theme/colors';

const FILTER_TABS = [
  { id: 'all', label: 'All Classes' },
  { id: 'live', label: 'Live Now' },
  { id: 'scheduled', label: 'Scheduled / Upcoming' },
];

export function MyClassesScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const { classes, isLoading: loadingClasses } = useTutorAcceptedRequests(user?.uid);
  const { sessions, isLoading: loadingSessions } = useTutorSessions(user?.uid);
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const classesWithSessions = useMemo(() => {
    const byRequestId = new Map(sessions.map((session) => [session.requestId, session]));
    return classes.map((request) => ({
      request,
      session: byRequestId.get(request.id) || null,
    }));
  }, [classes, sessions]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'live') {
      return classesWithSessions.filter(
        ({ request, session }) => session?.status === 'in_progress' || request.status === 'in_session'
      );
    }
    if (activeTab === 'scheduled') {
      return classesWithSessions.filter(
        ({ request, session }) => session?.status !== 'in_progress' && request.status !== 'in_session'
      );
    }
    return classesWithSessions;
  }, [classesWithSessions, activeTab]);

  const isLoading = loadingClasses || loadingSessions;

  const handleOpenSession = (sessionId, request) => {
    if (request?.mode === 'in_person' || Boolean(request?.studentLocation || request?.destination)) {
      const status = String(request?.status || '').toLowerCase();
      if (['in_progress', 'in_session'].includes(status)) {
        navigate('TutorActiveSession', {
          requestId: request?.id || '',
          sessionId: sessionId || request?.id || '',
          request,
        });
        return;
      }
      if (['completed', 'settled'].includes(status)) {
        navigate('TutorSessionSummary', {
          requestId: request?.id || '',
          sessionId: sessionId || request?.id || '',
          request,
        });
        return;
      }
      navigate('TutorNavigation', {
        requestId: request?.id || '',
        sessionId: sessionId || '',
        request,
      });
      return;
    }
    if (sessionId) {
      navigate('SessionRoom', { sessionId });
    }
  };

  const handleCancelSession = (requestId, sessionId) => {
    Alert.alert(
      'Cancel Class?',
      'Are you sure you want to cancel this class? This will release the student request and stop navigation.',
      [
        { text: 'Keep Class', style: 'cancel' },
        {
          text: 'Yes, Cancel Class',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelClassRequestAndSession({
                requestId,
                sessionId,
                tutorId: user?.uid,
                reason: 'Canceled by tutor from My Classes',
              });
              Alert.alert('Class Canceled', 'The class request and session have been canceled.');
            } catch (err) {
              console.error('Failed to cancel session:', err);
              Alert.alert('Cancel Failed', err?.message || 'Unable to cancel the class. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Classes"
        subtitle="Active classes and upcoming accepted student sessions"
        onBack={goBack}
      />

      {/* Filter Tabs */}
      <View style={styles.tabRail}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingState message="Syncing your class schedule..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={activeTab === 'live' ? 'No live classes right now' : 'No classes scheduled yet'}
          description={
            activeTab === 'live'
              ? 'When a student joins your session room, it will appear here.'
              : 'Accept incoming student requests from the dashboard to build your teaching queue.'
          }
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={({ request }) => request.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={colors.brand}
            />
          }
          renderItem={({ item }) => (
            <ClassQueueCard
              request={item.request}
              session={item.session}
              onOpenSession={handleOpenSession}
              onCancelSession={handleCancelSession}
            />
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
  tabRail: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: {
    backgroundColor: colors.brandLight,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
