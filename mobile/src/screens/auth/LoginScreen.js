import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { ErrorState } from '../../components/ui/States';
import { LEGAL_URLS } from '../../constants/legal';
import { useAuth } from '../../context/AuthContext';
import { TUTOR_LOGIN_BLOCKED_CODE } from '../../services/authService';
import { colors } from '../../theme/colors';

const authHighlights = ['Verified tutors only', 'Secure card authorization', 'Flexible live sessions'];

export function LoginScreen({ navigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tutorBlocked, setTutorBlocked] = useState(false);
  const openLegalUrl = (url) => Linking.openURL(url).catch(() => null);

  async function submit() {
    setBusy(true);
    setError('');
    setNotice('');
    setTutorBlocked(false);
    try {
      await login({ email, password });
    } catch (nextError) {
      if (nextError?.code === TUTOR_LOGIN_BLOCKED_CODE) {
        setTutorBlocked(true);
      }
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  function handleSocialPlaceholder(provider) {
    setError('');
    setNotice(`${provider} login is coming soon.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => navigate('Signup')} style={styles.switchLink}>
        <Text style={styles.switchText}>Sign up</Text>
      </Pressable>

      <View style={styles.brandStage}>
        <View style={styles.brandShadow} />
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>P</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Sign in Parakleo</Text>

        {tutorBlocked ? (
          <>
            <ErrorState title="Tutor Login Not Allowed" message={error || 'Tutors are not allowed to log in on this app.'} />
            <Button variant="secondary" onPress={() => navigate('Login')}>
              Go Back
            </Button>
          </>
        ) : (
          <>
            {error ? <ErrorState title="Sign in failed" message={error} /> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Text style={styles.authCopy}>
              Request a class in minutes, learn with verified tutors, and keep your sessions simple from the student app.
            </Text>
            <View style={styles.trustList}>
              {authHighlights.map((item) => (
                <View key={item} style={styles.trustItem}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
                  <Text style={styles.trustText}>{item}</Text>
                </View>
              ))}
            </View>

            <FormField
              autoCapitalize="none"
              inputStyle={styles.input}
              keyboardType="email-address"
              label="Email address"
              onChangeText={setEmail}
              placeholder="Enter your email"
              value={email}
            />
            <FormField
              inputStyle={styles.input}
              label="Password"
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
            />

            <Pressable accessibilityRole="button" onPress={() => navigate('ForgotPassword')} style={styles.forgotLink}>
              <Text style={styles.link}>Forgot Password?</Text>
            </Pressable>

            <Text style={styles.policy}>
              By signing in, you agree to Parakleo's{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.terms)}>Terms of Service</Text>,{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.privacy)}>Privacy Policy</Text>,{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.payment)}>Payment Policy</Text>,{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.refund)}>Refund Policy</Text>, and{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.dataVoice)}>Data and Voice Policy</Text>.
            </Text>

            <Button disabled={busy || !email || !password} onPress={submit} style={styles.primaryButton} textStyle={styles.primaryButtonText}>
              {busy ? 'Signing in...' : 'Login'}
            </Button>

            <View style={styles.socialRow}>
              <Pressable accessibilityRole="button" onPress={() => handleSocialPlaceholder('Apple')} style={styles.socialButton}>
                <Ionicons name="logo-apple" size={18} color={colors.text} />
                <Text style={styles.socialText}>Apple</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => handleSocialPlaceholder('Google')} style={styles.socialButton}>
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
            </View>
          </>
        )}
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
    marginBottom: 24,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  authCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  trustList: {
    gap: 8,
  },
  trustItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.18)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  trustText: {
    color: '#3f3f46',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 18,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  link: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '800',
  },
  notice: {
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
  policy: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  policyLink: {
    color: colors.brandDark,
    fontWeight: '800',
    textDecorationLine: 'underline',
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
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  socialText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  googleMark: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '900',
  },
});
