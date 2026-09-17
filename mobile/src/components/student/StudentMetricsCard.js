import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function StudentMetricsCard({ metrics }) {
  const requestsCount = Number(metrics?.requestsCount || 0);
  const completedCount = Number(metrics?.completedCount || 0);
  const minutesAttended = Number(metrics?.minutesAttended || 0);
  const freeMinutes = Number(metrics?.freeMinutes || 0);

  const formatAttended = (minutes) => {
    if (minutes <= 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = (minutes / 60).toFixed(1);
    return `${hours.endsWith('.0') ? hours.slice(0, -2) : hours}h`;
  };

  const items = [
    {
      key: 'requests',
      label: 'Requests',
      value: String(requestsCount),
      icon: 'document-text-outline',
      iconColor: '#047857',
      bg: '#ecfdf5',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: String(completedCount),
      icon: 'checkmark-done-circle-outline',
      iconColor: '#0d9488',
      bg: '#f0fdfa',
    },
    {
      key: 'attended',
      label: 'Attended',
      value: formatAttended(minutesAttended),
      icon: 'time-outline',
      iconColor: '#0284c7',
      bg: '#f0f9ff',
    },
    {
      key: 'freeTime',
      label: 'Free Time',
      value: `${freeMinutes}m`,
      icon: 'gift-outline',
      iconColor: '#d97706',
      bg: '#fffbeb',
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
        <View style={styles.headerArea}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={14} color="#059669" style={styles.titleIcon} />
            <Text style={styles.titleText}>Your Learning Stats</Text>
          </View>
          <Text style={styles.subtitleText}>Track your progress & lesson activity</Text>
        </View>

        {/* 4 Metrics Row */}
        <View style={styles.metricsRow}>
          {items.map((item) => (
            <View key={item.key} style={styles.metricItem}>
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
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
    alignSelf: 'center',
    marginVertical: 4,
    maxWidth: 440,
    width: '100%',
  },
  tabLayerTop: {
    width: '76%',
    height: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(209, 250, 229, 0.7)',
    marginBottom: -4,
    zIndex: 1,
  },
  tabLayerMiddle: {
    width: '88%',
    height: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.8)',
    marginBottom: -4,
    zIndex: 2,
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#d1fae5',
    zIndex: 3,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleIcon: {
    marginRight: 2,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#064e3b',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
});
