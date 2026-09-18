import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/States';
import { LEGAL_URLS } from '../../constants/legal';
import { useAuth } from '../../context/AuthContext';
import { TUTOR_LOGIN_BLOCKED_CODE } from '../../services/authService';
import { colors } from '../../theme/colors';

export function LoginScreen({ navigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Hero Banner with Home Tutoring Image */}
          <View style={styles.imageHeroContainer}>
            <Image
              source={require('../../../assets/student-home-tutoring.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.imageGradientOverlay} />
            <View style={styles.heroTextOverlay}>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>STUDENT APP</Text>
              </View>
              <Text style={styles.heroTitle}>Welcome to Parakleo</Text>
              <Text style={styles.heroSubtitle}>Sign in to request verified in-person tutoring</Text>
            </View>
          </View>

          {/* Bottom Card containing redesigned Auth Fields */}
          <View style={styles.authCard}>
            <Text style={styles.cardHeading}>Sign In</Text>

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
                {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

                {/* Input: Email Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={19} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="student@example.com"
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                    />
                  </View>
                </View>

                {/* Input: Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={19} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your password"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      style={styles.eyeBtn}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color="#64748b"
                      />
                    </Pressable>
                  </View>
                </View>

                <Pressable accessibilityRole="button" onPress={() => navigate('ForgotPassword')} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>

                {/* Submit Button */}
                <Pressable
                  onPress={submit}
                  disabled={busy || !email || !password}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    pressed && styles.submitBtnPressed,
                    (busy || !email || !password) && styles.submitBtnDisabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Sign In</Text>
                  )}
                </Pressable>

                {/* Legal Policy Footer */}
                <Text style={styles.policyText}>
                  By signing in, you agree to Parakleo's{' '}
                  <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.terms)}>Terms of Service</Text>,{' '}
                  <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.privacy)}>Privacy Policy</Text>, and{' '}
                  <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.payment)}>Payment Policy</Text>.
                </Text>

                {/* Footer Link to Signup */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerPrompt}>Don't have an account? </Text>
                  <Pressable onPress={() => navigate('Signup')}>
                    <Text style={styles.footerAction}>Sign up for free</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
  },
  imageHeroContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.82,
  },
  imageGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  heroTextOverlay: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
  },
  pillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  pillBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  authCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  noticeText: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 12,
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    padding: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 6,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.88,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  policyText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
  policyLink: {
    color: '#059669',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  footerPrompt: {
    fontSize: 14,
    color: '#64748b',
  },
  footerAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
});
