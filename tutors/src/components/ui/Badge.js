import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export function Badge({ children, variant = 'zinc', style, textStyle }) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'emerald':
        return { bg: colors.brandLight, text: colors.brandDark, border: '#a7f3d0' };
      case 'sky':
        return { bg: colors.skyLight, text: colors.sky, border: '#bae6fd' };
      case 'amber':
        return { bg: colors.amberLight, text: colors.amber, border: '#fde68a' };
      case 'rose':
        return { bg: colors.dangerLight, text: colors.danger, border: '#fecdd3' };
      case 'violet':
        return { bg: colors.violetLight, text: colors.violet, border: '#ddd6fe' };
      default:
        return { bg: colors.zinc[100], text: colors.zinc[700], border: colors.zinc[200] };
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
