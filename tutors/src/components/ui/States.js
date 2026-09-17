import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title = 'No items found', description = '', icon = 'folder-open-outline' }) {
  return (
    <View style={styles.centerContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.textMuted} />
      </View>
      <Text style={styles.titleText}>{title}</Text>
      {description ? <Text style={styles.descText}>{description}</Text> : null}
    </View>
  );
}

export function ErrorState({ title = 'Error', message = 'Something went wrong', onRetry = null }) {
  return (
    <View style={styles.centerContainer}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      </View>
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.descText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  descText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
