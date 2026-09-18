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
import { ErrorState } from '../../components/ui/States';
import { LEGAL_URLS } from '../../constants/legal';
import { useAuth } from '../../context/AuthContext';

export function SignupScreen({ navigate }) {
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
              <Text style={styles.heroTitle}>Create Account</Text>
              <Text style={styles.heroSubtitle}>Join Parakleo to request verified in-person tutors</Text>
            </View>
          </View>

          {/* Bottom Card containing redesigned Auth Fields */}
          <View style={styles.authCard}>
            <Text style={styles.cardHeading}>Sign Up</Text>

            {error ? <ErrorState title="Signup failed" message={error} /> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            {/* Input: First & Last Name */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={styles.inputLabel}>First Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={19} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="First name"
                    placeholderTextColor="#94a3b8"
                    value={firstName}
                    onChangeText={setFirstName}
                    editable={!busy}
                  />
                </View>
              </View>
              <View style={styles.nameField}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={19} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Last name"
                    placeholderTextColor="#94a3b8"
                    value={lastName}
                    onChangeText={setLastName}
                    editable={!busy}
                  />
                </View>
              </View>
            </View>

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
                  placeholder="At least 6 characters"
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

            {/* Submit Button */}
            <Pressable
              onPress={submit}
              disabled={busy || !fullName || !email || password.length < 6}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
                (busy || !fullName || !email || password.length < 6) && styles.submitBtnDisabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </Pressable>

            {/* Legal Policy Footer */}
            <Text style={styles.policyText}>
              By signing up, you agree to Parakleo's{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.terms)}>Terms of Service</Text>,{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.privacy)}>Privacy Policy</Text>, and{' '}
              <Text style={styles.policyLink} onPress={() => openLegalUrl(LEGAL_URLS.payment)}>Payment Policy</Text>.
            </Text>

            {/* Footer Link to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>Already registered? </Text>
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
    marginBottom: 18,
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
