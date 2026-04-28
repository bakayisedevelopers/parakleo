import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';

const trustItems = ['Verified tutors only', 'Secure card authorization', 'Flexible live sessions'];

export function HomeScreen({ navigate }) {
  return (
    <View style={styles.page}>
      <View style={styles.brandGlowTop} />
      <View style={styles.brandGlowBottom} />
      <Card style={styles.hero}>
        <Text style={styles.kicker}>Student Portal</Text>
        <Text style={styles.title}>Effective on request sessions.</Text>
        <Text style={styles.copy}>
          <Text style={styles.discover}>Discover</Text> verified tutors, request a session in minutes, and learn with confidence through a polished, reliable flow.
        </Text>
        <View style={styles.actions}>
          <Button onPress={() => navigate('Signup')}>Request Class Now</Button>
          <Button variant="secondary" onPress={() => navigate('Login')}>Login</Button>
        </View>
        <View style={styles.trustList}>
          {trustItems.map((item) => (
            <View key={item} style={styles.trustItem}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service, Privacy Policy, and Payment Policy.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f4f4f5',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  brandGlowTop: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderRadius: 160,
    height: 220,
    position: 'absolute',
    right: -90,
    top: 36,
    width: 220,
  },
  brandGlowBottom: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 160,
    bottom: 18,
    height: 220,
    left: -96,
    position: 'absolute',
    width: 220,
  },
  hero: {
    gap: 18,
    padding: 24,
  },
  kicker: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 44,
  },
  copy: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
  },
  discover: {
    color: '#22c55e',
  },
  actions: {
    gap: 12,
  },
  trustList: {
    gap: 10,
  },
  trustItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  check: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '900',
  },
  trustText: {
    color: '#3f3f46',
    fontSize: 14,
    fontWeight: '600',
  },
  terms: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
