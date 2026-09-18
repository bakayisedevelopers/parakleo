import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { ErrorState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';

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
                <Text style={styles.pillBadgeText}>ACCOUNT RECOVERY</Text>
              </View>
              <Text style={styles.heroTitle}>Reset Password</Text>
              <Text style={styles.heroSubtitle}>We'll send a secure link to restore your account</Text>
            </View>
          </View>

          {/* Bottom Card containing redesigned Auth Fields */}
          <View style={styles.authCard}>
            <Text style={styles.cardHeading}>Forgot Password?</Text>
            <Text style={styles.cardSubheading}>
              Enter your registered email address below to receive password reset instructions.
            </Text>

            {error ? <ErrorState title="Reset failed" message={error} /> : null}
            {sent ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#166534" />
                <Text style={styles.successBannerText}>
                  Password reset email sent. Please check your inbox.
                </Text>
              </View>
            ) : null}

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

            {/* Submit Button */}
            <Pressable
              onPress={submit}
              disabled={busy || !email}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
                (busy || !email) && styles.submitBtnDisabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Send Reset Link</Text>
              )}
            </Pressable>

            {/* Back to Login Link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>Remembered your password? </Text>
              <Pressable onPress={() => navigate('Login')}>
                <Text style={styles.footerAction}>Sign in here</Text>
              </Pressable>
            </View>
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
    marginBottom: 6,
  },
  cardSubheading: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
    gap: 8,
  },
  successBannerText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  submitBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
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
