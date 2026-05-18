import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SOUTH_AFRICAN_SUBJECTS, normalizeSubjectList } from '../../constants/subjects';
import { colors } from '../../theme/colors';

export function SubjectPicker({ value = [], onChange }) {
  const selected = normalizeSubjectList(value);

  function toggle(subject) {
    if (selected.includes(subject)) {
      onChange(selected.filter((item) => item !== subject));
      return;
    }
    onChange([...selected, subject]);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Subjects</Text>
      <View style={styles.options}>
        {SOUTH_AFRICAN_SUBJECTS.map((subject) => {
          const active = selected.includes(subject);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              key={subject}
              onPress={() => toggle(subject)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{subject}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionActive: {
    backgroundColor: '#ecfdf5',
    borderColor: colors.brand,
  },
  optionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  optionTextActive: {
    color: colors.brandDark,
  },
});
