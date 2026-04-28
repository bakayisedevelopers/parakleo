import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { ErrorState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export function SignupScreen({ navigate }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await signup({ name, email, password });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.glowRight} />
      <View style={styles.glowLeft} />
      <View style={styles.header}>
        <Pressable onPress={() => navigate('Home')} style={styles.backLink}>
          <Text style={styles.backText}>← Back to home</Text>
        </Pressable>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Already have an account? <Text style={styles.link} onPress={() => navigate('Login')}>Sign in</Text>
        </Text>
      </View>
      <Card style={styles.form}>
        {error ? <ErrorState title="Signup failed" message={error} /> : null}
        <View style={styles.roleGrid}>
          <View style={[styles.roleCard, styles.roleCardActive]}>
            <Text style={styles.roleIcon}>S</Text>
            <Text style={styles.roleTextActive}>I'm a Student</Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleIconMuted}>T</Text>
            <Text style={styles.roleText}>I'm a Tutor</Text>
          </View>
        </View>
        <FormField label="Full name" value={name} onChangeText={setName} />
        <FormField label="Email address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="name@company.com" />
        <FormField label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />
        <Text style={styles.policy}>
          By signing up, you agree to our Terms of Service, Privacy Policy, Payment Policy, and Data and Voice Policy.
        </Text>
        <Button disabled={busy || !name || !email || password.length < 6} onPress={submit}>
          {busy ? 'Creating account...' : 'Create Account'}
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f4f4f5',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 16,
  },
  glowRight: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderRadius: 160,
    height: 240,
    position: 'absolute',
    right: -98,
    top: 0,
    width: 240,
  },
  glowLeft: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 160,
    bottom: 0,
    height: 240,
    left: -98,
    position: 'absolute',
    width: 240,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  backLink: {
    marginBottom: 16,
  },
  backText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    color: colors.brand,
    fontWeight: '900',
  },
  form: {
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 32,
    gap: 16,
    padding: 24,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 2,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  roleCardActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  roleIcon: {
    color: '#ffffff',
    fontSize: 28,
  },
  roleIconMuted: {
    color: colors.muted,
    fontSize: 28,
  },
  roleTextActive: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  roleText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  policy: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#3f3f46',
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
});
