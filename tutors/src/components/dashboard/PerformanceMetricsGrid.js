import { StyleSheet, View } from 'react-native';
import { MetricTile } from '../ui/MetricTile';

export function PerformanceMetricsGrid({ metrics }) {
  const formatPercent = (val) => `${Math.max(0, val <= 1 ? val * 100 : val).toFixed(1)}%`;

  return (
    <View style={styles.grid}>
      <MetricTile
        label="Acceptance Rate"
        value={formatPercent(metrics?.acceptanceRate ?? 100)}
        style={styles.metricItem}
      />
      <MetricTile
        label="Completion Rate"
        value={formatPercent(metrics?.completionRate ?? 100)}
        style={styles.metricItem}
      />
      <MetricTile
        label="Tutor Rating"
        value={metrics?.overallRating > 0 ? `★ ${Number(metrics.overallRating).toFixed(1)}` : '5.0'}
        style={styles.metricItem}
      />
      <MetricTile
        label="Avg Response"
        value={`${Number(metrics?.avgResponseSeconds || 15).toFixed(0)}s`}
        style={styles.metricItem}
      />
      <MetricTile
        label="Cancellation Rate"
        value={formatPercent(metrics?.cancellationRate ?? 0)}
        style={styles.metricItem}
      />
      <MetricTile
        label="24h Assignments"
        value={`${Number(metrics?.recentAssignmentsCount || 0).toFixed(0)} completed`}
        style={styles.metricItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    minWidth: '47%',
  },
});
