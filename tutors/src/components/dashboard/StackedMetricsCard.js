import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export function StackedMetricsCard({ metrics }) {
  const formatPercent = (val) => `${Math.max(0, val <= 1 ? val * 100 : val).toFixed(0)}%`;

  const acceptanceVal = formatPercent(metrics?.acceptanceRate ?? 100);
  const completionVal = formatPercent(metrics?.completionRate ?? 100);
  const ratingVal = metrics?.overallRating > 0 ? `${Number(metrics.overallRating).toFixed(1)}★` : '5.0★';
  const responseVal = `${Number(metrics?.avgResponseSeconds || 15).toFixed(0)}s`;

  const items = [
    {
      key: 'acceptance',
      label: 'Acceptance',
      value: acceptanceVal,
      icon: 'checkmark-circle-outline',
      iconColor: colors.brandDark,
      bg: '#ecfdf5',
    },
    {
      key: 'completion',
      label: 'Completion',
      value: completionVal,
      icon: 'shield-checkmark-outline',
      iconColor: '#0d9488',
      bg: '#f0fdfa',
    },
    {
      key: 'rating',
      label: 'Rating',
      value: ratingVal,
      icon: 'star-outline',
      iconColor: '#d97706',
      bg: '#fffbeb',
    },
    {
      key: 'response',
      label: 'Response',
      value: responseVal,
      icon: 'timer-outline',
      iconColor: '#0284c7',
      bg: '#f0f9ff',
    },
  ];

  return (
    <View style={styles.stackWrapper}>
      {/* Background Tab Layer 1 (topmost stacked card edge) */}
      <View style={styles.tabLayerTop} />

      {/* Background Tab Layer 2 (middle stacked card edge) */}
      <View style={styles.tabLayerMiddle} />

      {/* Foreground Main Card */}
      <View style={styles.mainCard}>
        {/* Card Header (matching "Drawing Room" / "8 Running Device") */}
        <View style={styles.headerArea}>
          <Text style={styles.titleText}>Tutor Performance</Text>
          <Text style={styles.subtitleText}>4 Live Dispatch Metrics</Text>
        </View>

        {/* 4 Metrics Row (matching AC, Light, TV, Coffee Machine layout) */}
        <View style={styles.metricsRow}>
          {items.map((item) => (
            <View key={item.key} style={styles.metricItem}>
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrapper: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  tabLayerTop: {
    width: '74%',
    height: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    marginBottom: -5,
    zIndex: 1,
  },
  tabLayerMiddle: {
    width: '88%',
    height: 12,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    marginBottom: -5,
    zIndex: 2,
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 3,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 18,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18181b',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717a',
    marginTop: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#18181b',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717a',
    marginTop: 3,
    textAlign: 'center',
  },
});
