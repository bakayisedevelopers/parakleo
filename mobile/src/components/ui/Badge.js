import { StyleSheet, Text, View } from 'react-native';

export function Badge({ children, variant = 'zinc', style, textStyle }) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'emerald':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'sky':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'amber':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'rose':
        return { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' };
      case 'violet':
        return { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' };
      case 'zinc':
      default:
        return { bg: '#f4f4f5', text: '#3f3f46', border: '#e4e4e7' };
    }
  };

  const scheme = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: scheme.bg, borderColor: scheme.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: scheme.text }, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
