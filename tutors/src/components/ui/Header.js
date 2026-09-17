import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export function Header({
  title,
  subtitle,
  onBack,
  backIconName = 'chevron-back',
  transparentBackButton = true,
  rightElement,
  style,
}) {
  return (
    <View style={[styles.headerCapsule, style]}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.backButton,
              transparentBackButton && styles.transparentBackButton,
              pressed && {
                opacity: 0.7,
                ...(transparentBackButton ? {} : { backgroundColor: '#e4e4e7' }),
              },
            ]}
          >
            <Ionicons name={backIconName} size={20} color="#18181b" />
          </Pressable>
        ) : null}
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightElement ? (
        <View style={styles.rightContainer}>{rightElement}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transparentBackButton: {
    backgroundColor: 'transparent',
  },
  titleWrapper: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181b',
  },
  subtitleText: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 1,
  },
  rightContainer: {
    marginLeft: 10,
  },
});
