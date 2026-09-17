import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export function HomeScreen({ initialMode = 'signin' }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuthSubmit = async () => {
    setError('');

    if (mode === 'signup') {
      if (!fullName.trim() || !email.trim() || !password) {
        setError('Please fill in your full name, email address, and password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }

      try {
        setLoading(true);
        await signup({ email: email.trim(), password, fullName: fullName.trim() });
      } catch (err) {
        setError(err?.message || 'Unable to register as a tutor. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim() || !password) {
        setError('Please enter both your email address and password.');
        return;
      }

      try {
        setLoading(true);
        await login(email.trim(), password);
      } catch (err) {
        setError(err?.message || 'Invalid email or password. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Background Decorative Ambient Glows */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.ambientTopLeft} />
        <View style={styles.ambientBottomRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Welcome Header */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../../assets/Logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.badgePill}>
              <View style={styles.pulsingDot} />
              <Text style={styles.badgePillText}>PARAKLEO TUTORS</Text>
            </View>
          </View>

          {/* Segmented Mode Switcher */}
          <View style={styles.segmentedContainer}>
            <Pressable
              onPress={() => switchMode('signin')}
              style={[styles.segmentBtn, mode === 'signin' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>
                Sign In
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode('signup')}
              style={[styles.segmentBtn, mode === 'signup' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>
                Apply as Tutor
              </Text>
            </Pressable>
          </View>

          {/* Unified Auth Card */}
          <View style={styles.authCard}>
            <Text style={styles.cardHeading}>
              {mode === 'signin' ? 'Sign in to your dashboard' : 'Create your tutor account'}
            </Text>
            <Text style={styles.cardSubheading}>
              {mode === 'signin'
                ? 'Welcome back! Enter your credentials to continue.'
                : 'Join our verified tutor network and start receiving student requests.'}
            </Text>

            {mode === 'signup' && (
              <View style={styles.noticeBanner}>
                <Ionicons name="sparkles" size={16} color={colors.brandDark} />
                <Text style={styles.noticeBannerText}>
                  Receive weekly direct deposits at <Text style={styles.bold}>73% payout rate</Text>.
                </Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Input: Full Name (Sign up only) */}
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={19} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#a1a1aa"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            {/* Input: Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={19} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="tutor@example.com"
                  placeholderTextColor="#a1a1aa"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Input: Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  placeholderTextColor="#a1a1aa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Action Submit Button */}
            <Pressable
              onPress={handleAuthSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
                loading && styles.submitBtnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'signin' ? 'Sign In to Dashboard' : 'Create Tutor Account'}
                </Text>
              )}
            </Pressable>

            {/* Quick Switch Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>
                {mode === 'signin' ? "Don't have an account? " : 'Already registered? '}
              </Text>
              <Pressable onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                <Text style={styles.footerAction}>
                  {mode === 'signin' ? 'Sign up for free' : 'Sign in here'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Value Props & Perks Highlight */}
          <View style={styles.perksRow}>
            <View style={styles.perkItem}>
              <Ionicons name="cash-outline" size={15} color={colors.brandDark} />
              <Text style={styles.perkText}>73% Tutor Split</Text>
            </View>
            <View style={styles.perkItem}>
              <Ionicons name="card-outline" size={15} color={colors.brandDark} />
              <Text style={styles.perkText}>Weekly Direct Bank</Text>
            </View>
            <View style={styles.perkItem}>
              <Ionicons name="time-outline" size={15} color={colors.brandDark} />
              <Text style={styles.perkText}>Flexible Hours</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f4f5', // zinc-100 matching web
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  ambientContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  ambientBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(5, 150, 105, 0.10)',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  logoBadgeContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  logo: {
    width: 44,
    height: 44,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brandDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#ecfdf5', // soft emerald background
    borderRadius: 9999, // fully rounded pill
    borderWidth: 1.5,
    borderColor: '#10b981', // green border
    padding: 4,
    width: '100%',
    maxWidth: 380,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12, // slightly bigger height
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999, // fully rounded inner button
  },
  segmentBtnActive: {
    backgroundColor: '#10b981', // green selected tab indicator
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46', // dark emerald for unselected
  },
  segmentTextActive: {
    fontWeight: '800',
    color: '#ffffff', // crisp white on green
  },
  authCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.18)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardSubheading: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    marginBottom: 16,
  },
  noticeBannerText: {
    fontSize: 12,
    color: colors.brandDark,
    flex: 1,
    lineHeight: 16,
  },
  bold: {
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerPrompt: {
    fontSize: 13,
    color: colors.textMuted,
  },
  footerAction: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brandDark,
  },
  perksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  perkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#52525b',
  },
});
