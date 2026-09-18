import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
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
                <Text style={styles.pillBadgeText}>PARAKLEO TUTORS</Text>
              </View>
              <Text style={styles.heroTitle}>
                {mode === 'signin' ? 'Welcome Back' : 'Join Our Tutor Network'}
              </Text>
              <Text style={styles.heroSubtitle}>
                {mode === 'signin'
                  ? 'Sign in to access your tutoring dashboard & sessions'
                  : 'Start accepting student requests and earning weekly'}
              </Text>
            </View>
          </View>

          {/* Bottom Card containing redesigned Auth Fields */}
          <View style={styles.authCard}>
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

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Input: Full Name (Sign up only) */}
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={19} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94a3b8"
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
                <Ionicons name="mail-outline" size={19} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="tutor@example.com"
                  placeholderTextColor="#94a3b8"
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
                <Ionicons name="lock-closed-outline" size={19} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  placeholderTextColor="#94a3b8"
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
                    color="#64748b"
                  />
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
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

            {/* Footer Prompt */}
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
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  errorBannerText: {
    color: '#dc2626',
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
  eyeBtn: {
    padding: 6,
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
