import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { formatCurrency } from '../../utils/payouts';
import { colors } from '../../theme/colors';

export function EarningsSummaryCard({
  lifetimeEarnings = 0,
  unpaidAmount = 0,
  paidAmount = 0,
  currentWeekAmount = 0,
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.headerTitle}>Financial Overview</Text>

      <View style={styles.grid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Lifetime Earnings</Text>
          <Text style={[styles.metricValue, styles.highlightValue]}>
            {formatCurrency(lifetimeEarnings)}
          </Text>
          <Text style={styles.metricHelper}>Total net earned</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Current Week</Text>
          <Text style={styles.metricValue}>
            {formatCurrency(currentWeekAmount)}
          </Text>
          <Text style={styles.metricHelper}>Mon–Sun balance</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Unpaid Balance</Text>
          <Text style={[styles.metricValue, { color: colors.amber }]}>
            {formatCurrency(unpaidAmount)}
          </Text>
          <Text style={styles.metricHelper}>Ready for next cycle</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Paid to Bank</Text>
          <Text style={[styles.metricValue, { color: colors.brandDark }]}>
            {formatCurrency(paidAmount)}
          </Text>
          <Text style={styles.metricHelper}>Disbursed payouts</Text>
        </View>
      </View>

      <View style={styles.feeSplitRow}>
        <View style={styles.feeBadge}>
          <Text style={styles.feeBadgeText}>73% Tutor Split Rate</Text>
        </View>
        <View style={[styles.feeBadge, styles.platformFeeBadge]}>
          <Text style={styles.platformFeeText}>20% Platform Fee</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricItem: {
    width: '47%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
  },
  highlightValue: {
    color: colors.brandDark,
  },
  metricHelper: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  feeSplitRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  feeBadge: {
    flex: 1,
    backgroundColor: colors.brandLight,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  feeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandDark,
  },
  platformFeeBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  platformFeeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
