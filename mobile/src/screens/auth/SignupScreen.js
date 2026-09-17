import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { ErrorState } from '../../components/ui/States';
import { LEGAL_URLS } from '../../constants/legal';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const authHighlights = ['Verified tutors only', 'Secure card authorization', 'Flexible live sessions'];

export function SignupScreen({ navigate }) {
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const openLegalUrl = (url) => Linking.openURL(url).catch(() => null);
  const fullName = `${firstName} ${lastName}`.trim();

  async function submit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signup({ name: fullName, email, password });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  function handleSocialPlaceholder(provider) {
    setError('');
    setNotice(`${provider} signup is coming soon.`);
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
        <Text style={styles.title}>Sign up in Parakleo</Text>

        {error ? <ErrorState title="Signup failed" message={error} /> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={styles.authCopy}>
          Create your student account, request support quickly, and review every class before confirming.
        </Text>
        <View style={styles.trustList}>
          {authHighlights.map((item) => (
            <View key={item} style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <FormField inputStyle={styles.input} label="First name" onChangeText={setFirstName} placeholder="First name" value={firstName} />
          </View>
          <View style={styles.nameField}>
            <FormField inputStyle={styles.input} label="Last name" onChangeText={setLastName} placeholder="Last name" value={lastName} />
          </View>
        </View>

        <FormField
          autoCapitalize="none"
          inputStyle={styles.input}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="Enter your email"
          value={email}
        />
        <FormField
          inputStyle={styles.input}
          label="Password"
          onChangeText={setPassword}
          placeholder="Create your password"
          secureTextEntry
          value={password}
        />

        <Text style={styles.policy}>
          By signing up, you agree to our{' '}
          <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.terms)}>Terms of Service</Text>,{' '}
          <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.privacy)}>Privacy Policy</Text>,{' '}
          <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.payment)}>Payment Policy</Text>,{' '}
          <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.refund)}>Refund Policy</Text>, and{' '}
          <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.dataVoice)}>Data and Voice Policy</Text>.
        </Text>

        <Button disabled={busy || !fullName || !email || password.length < 6} onPress={submit} style={styles.primaryButton} textStyle={styles.primaryButtonText}>
          {busy ? 'Creating account...' : 'Continue'}
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
    marginBottom: 14,
  },
  switchText: {
    color: colors.brandDark,
    fontSize: 15,
    fontWeight: '800',
  },
  brandStage: {
    alignItems: 'center',
    height: 172,
    justifyContent: 'center',
    marginBottom: 2,
  },
  brandShadow: {
    backgroundColor: 'rgba(4,120,87,0.10)',
    borderColor: 'rgba(16,185,129,0.14)',
    borderRadius: 32,
    borderWidth: 1,
    bottom: 24,
    height: 86,
    position: 'absolute',
    transform: [{ rotate: '-10deg' }],
    width: 124,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 32,
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    transform: [{ rotate: '45deg' }],
    width: 104,
  },
  brandLetter: {
    color: colors.brand,
    fontSize: 50,
    fontWeight: '900',
    transform: [{ rotate: '-45deg' }],
  },
  panel: {
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 30,
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(16,185,129,0.24)',
    borderRadius: 18,
    minHeight: 56,
    paddingHorizontal: 18,
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
