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
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Header } from '../../components/ui/Header';
import { BankingDetailsCard } from '../../components/payments/BankingDetailsCard';
import { EarningsSummaryCard } from '../../components/payments/EarningsSummaryCard';
import { useAuth } from '../../context/AuthContext';
import { useTutorSessions } from '../../hooks/useSessions';
import {
  formatCurrency,
  formatWeekRangeLabel,
  groupSessionsByWeek,
  toDateValue,
} from '../../utils/payouts';
import { TUTOR_PAYOUT_RATE } from '../../constants/pricing';
import { colors } from '../../theme/colors';

export function TutorPaymentsScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const { sessions, isLoading } = useTutorSessions(user?.uid);
  const [expandedWeekKey, setExpandedWeekKey] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const tutorProfile = user?.tutorProfile || {};
  const bankingDetails =
    (tutorProfile?.payout?.accountNumber ? tutorProfile.payout : null) ||
    (tutorProfile?.bankingDetails?.accountNumber ? tutorProfile.bankingDetails : null) ||
    (user?.payout?.accountNumber ? user.payout : null) ||
    (user?.bankingDetails?.accountNumber ? user.bankingDetails : null) ||
    tutorProfile.payout ||
    tutorProfile.bankingDetails ||
    user?.payout ||
    user?.bankingDetails ||
    {};

  const weeklyGroups = useMemo(() => {
    const completed = sessions.filter((session) => session.status === 'completed');
    return groupSessionsByWeek(completed);
  }, [sessions]);

  const summaries = useMemo(() => {
    const lifetimeEarnings = weeklyGroups.reduce((sum, item) => sum + Number(item.tutorAmount || 0), 0);
    const currentDate = new Date();

    const currentWeekGroup = weeklyGroups.find((item) => {
      const weekStart = toDateValue(item.weekStart);
      const weekEnd = toDateValue(item.weekEnd);
      return weekStart && weekEnd && currentDate >= weekStart && currentDate <= weekEnd;
    });

    const currentWeekAmount = Number(currentWeekGroup?.tutorAmount || 0);
    const unpaidAmount = lifetimeEarnings; // unreleased in current cycle

    return {
      lifetimeEarnings,
      currentWeekAmount,
      unpaidAmount,
      paidAmount: 0,
    };
  }, [weeklyGroups]);

  const toggleExpand = (weekKey) => {
    setExpandedWeekKey((prev) => (prev === weekKey ? '' : weekKey));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Earnings & Payouts"
        subtitle="Weekly payouts and lesson revenue"
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

      {isLoading ? (
        <LoadingState message="Calculating weekly payout records..." />
      ) : (
        <FlatList
          data={weeklyGroups}
          keyExtractor={(item) => item.weekKey}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={
            <>
              <EarningsSummaryCard
                lifetimeEarnings={summaries.lifetimeEarnings}
                currentWeekAmount={summaries.currentWeekAmount}
                unpaidAmount={summaries.unpaidAmount}
                paidAmount={summaries.paidAmount}
              />
              <BankingDetailsCard
                bankingDetails={bankingDetails}
                onEdit={() => navigate('Onboarding', { initialStep: 'payout' })}
              />
              <Text style={styles.sectionTitle}>Weekly Payout Cycles</Text>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="No Payout Cycles Yet"
              description="Complete your first tutoring sessions to start accumulating weekly balances."
            />
          }
          renderItem={({ item }) => {
            const isExpanded = expandedWeekKey === item.weekKey;
            const weekRangeText = formatWeekRangeLabel(item.weekStart, item.weekEnd);

            return (
              <Card style={styles.weekCard}>
                <Pressable onPress={() => toggleExpand(item.weekKey)} style={styles.weekHeaderRow}>
                  <View style={styles.weekMetaCol}>
                    <Text style={styles.weekKeyText}>{item.weekKey}</Text>
                    <Text style={styles.weekRangeText}>{weekRangeText}</Text>
                  </View>
                  <View style={styles.weekAmountCol}>
                    <Text style={styles.weekAmountText}>{formatCurrency(item.tutorAmount)}</Text>
                    <Badge variant={item.paidAt ? 'emerald' : 'zinc'}>
                      {item.paidAt ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                    style={styles.chevron}
                  />
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.expandedHeader}>
                      {item.totalSessions} completed session(s) in this cycle:
                    </Text>
                    {item.sessions.map((sess) => (
                      <View key={sess.id} style={styles.sessionRow}>
                        <View style={styles.sessionLeft}>
                          <Text style={styles.sessionTopic}>{sess.topic || 'Class'}</Text>
                          <Text style={styles.sessionStudent}>Student: {sess.studentName || 'Student'}</Text>
                        </View>
                        <Text style={styles.sessionEarning}>
                          +{formatCurrency(sess.totalAmount ? sess.totalAmount * TUTOR_PAYOUT_RATE : 0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          }}
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
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  weekCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekMetaCol: {
    flex: 1,
  },
  weekKeyText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  weekRangeText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  weekAmountCol: {
    alignItems: 'flex-end',
    marginRight: 10,
    gap: 4,
  },
  weekAmountText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.brandDark,
  },
  chevron: {
    marginLeft: 4,
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    gap: 8,
  },
  expandedHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
  },
  sessionLeft: {
    flex: 1,
  },
  sessionTopic: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  sessionStudent: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  sessionEarning: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brandDark,
  },
});
