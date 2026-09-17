import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { ErrorState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export function ForgotPasswordScreen({ navigate }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => navigate('Login')} style={styles.switchLink}>
        <Text style={styles.switchText}>Sign in</Text>
      </Pressable>

      <View style={styles.brandStage}>
        <View style={styles.brandShadow} />
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>P</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter your email and we will send you a secure link to create a new password.</Text>

        {error ? <ErrorState title="Reset failed" message={error} /> : null}
        {sent ? <Text style={styles.success}>Password reset email sent. Please check your inbox.</Text> : null}

        <FormField
          autoCapitalize="none"
          inputStyle={styles.input}
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="Enter your email"
          value={email}
        />

        <Button disabled={busy || !email} onPress={submit} style={styles.primaryButton} textStyle={styles.primaryButtonText}>
          {busy ? 'Sending...' : 'Send reset link'}
        </Button>

        <Pressable accessibilityRole="button" onPress={() => navigate('Login')} style={styles.backToLogin}>
          <Text style={styles.link}>Back to login</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 32,
    paddingTop: 24,
  },
  switchLink: {
    alignSelf: 'flex-end',
    borderBottomColor: colors.brandDark,
    borderBottomWidth: 1,
    marginBottom: 34,
  },
  switchText: {
    color: colors.brandDark,
    fontSize: 15,
    fontWeight: '800',
  },
  brandStage: {
    alignItems: 'center',
    height: 188,
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandShadow: {
    backgroundColor: 'rgba(4,120,87,0.10)',
    borderColor: 'rgba(16,185,129,0.14)',
    borderRadius: 34,
    borderWidth: 1,
    bottom: 28,
    height: 92,
    position: 'absolute',
    transform: [{ rotate: '-10deg' }],
    width: 132,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 34,
    borderWidth: 1,
    height: 112,
    justifyContent: 'center',
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    transform: [{ rotate: '45deg' }],
    width: 112,
  },
  brandLetter: {
    color: colors.brand,
    fontSize: 54,
    fontWeight: '900',
    transform: [{ rotate: '-45deg' }],
  },
  panel: {
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 18,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  success: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderColor: 'rgba(16,185,129,0.20)',
    borderRadius: 16,
    borderWidth: 1,
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 22,
    minHeight: 58,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  link: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '800',
  },
});
