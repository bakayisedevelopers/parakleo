import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_TUTOR_AGREEMENT_CLAUSES,
  LEGAL_ENTITY_NAME,
  TUTOR_AGREEMENT_DEFAULT_VERSION,
  acceptTutorAgreement,
  getTutorAgreementBundle,
} from '../../services/legalAgreementService';
import { getTutorOnboardingStatus, isTutorAgreementCurrent } from '../../constants/onboarding';
import { getUserProfile } from '../../services/userService';
import { colors } from '../../theme/colors';

export function TutorAgreementScreen({ navigate, goBack }) {
  const { user, setUser } = useAuth();
  const [typedSignature, setTypedSignature] = useState(user?.fullName || user?.displayName || '');
  const [checkboxAccepted, setCheckboxAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [clauses, setClauses] = useState(DEFAULT_TUTOR_AGREEMENT_CLAUSES);

  const isSigned = useMemo(() => isTutorAgreementCurrent(user), [user]);
  const signedDate = user?.agreements?.tutorAgreementSignedAt || user?.tutorAgreement?.acceptedAt;

  useEffect(() => {
    getTutorAgreementBundle().then((bundle) => {
      if (bundle?.activeVersion?.clauses && Array.isArray(bundle.activeVersion.clauses)) {
        setClauses(bundle.activeVersion.clauses);
      }
    });
  }, []);

  const handleSignAgreement = async () => {
    if (!checkboxAccepted) {
      setErrorMessage('You must check the box to confirm your acceptance of the terms.');
      return;
    }

    if (!typedSignature.trim()) {
      setErrorMessage('Please type your legal full name to sign.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const result = await acceptTutorAgreement({
        typedSignatureName: typedSignature.trim(),
        checkboxAccepted: true,
      });

      const persistedUser = await getUserProfile(user.uid);
      const nextUser = persistedUser || { ...user, ...(result?.userUpdates || {}) };
      if (!isTutorAgreementCurrent(nextUser)) {
        throw new Error('Agreement was signed, but the profile update has not completed. Please try again.');
      }
      setUser((prev) => ({ ...prev, ...nextUser }));
      setStatusMessage('Tutor Agreement accepted and digitally signed.');
      const onboardingStatus = getTutorOnboardingStatus(nextUser);
      navigate('Onboarding', { initialStep: onboardingStatus.firstMissingStep });
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to record signature.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <Header
        title="Tutor Service Agreement"
        subtitle="Independent Contractor Terms & Conditions"
        onBack={goBack}
        backIconName="chevron-back"
        transparentBackButton
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {statusMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Contract Version: {TUTOR_AGREEMENT_DEFAULT_VERSION}</Text>
              <Text style={styles.statusSubtitle}>Entity: {LEGAL_ENTITY_NAME}</Text>
            </View>
            <Badge variant={isSigned ? 'emerald' : 'amber'}>
              {isSigned ? 'Signed & Active' : 'Signature Required'}
            </Badge>
          </View>
          {isSigned && signedDate ? (
            <Text style={styles.signedTimestampText}>
              Digitally signed on: {new Date(signedDate).toLocaleDateString()} by{' '}
              {user?.agreements?.typedSignatureName || user?.fullName}
            </Text>
          ) : null}
        </Card>

        {/* Agreement Text Clauses */}
        <Card style={styles.clausesCard}>
          <Text style={styles.contractTitle}>Independent Contractor Agreement</Text>
          <Text style={styles.contractIntro}>
            This Agreement governs the relationship between {LEGAL_ENTITY_NAME} ("Parakleo") and the independent tutoring contractor accepting these terms.
          </Text>

          {clauses.map((clause, index) => (
            <View key={`clause-${index}`} style={styles.clauseBlock}>
              <Text style={styles.clauseTitle}>{clause.title}</Text>
              <Text style={styles.clauseContent}>{clause.content}</Text>
            </View>
          ))}
        </Card>

        {/* Digital Signature Card */}
        <Card style={styles.signatureCard}>
          <Text style={styles.signatureHeader}>Digital Signature & Acceptance</Text>

          <Pressable
            onPress={() => setCheckboxAccepted(!checkboxAccepted)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, checkboxAccepted && styles.checkboxChecked]}>
              {checkboxAccepted ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
            </View>
            <Text style={styles.checkboxLabel}>
              I confirm that I am at least 18 years old, and I have read, understood, and agree to be bound by the terms of this Tutor Service Agreement.
            </Text>
          </Pressable>

          <FormField
            label="Type Full Legal Name as Signature"
            value={typedSignature}
            onChangeText={setTypedSignature}
            placeholder="e.g. Sipho Ndlovu"
            editable={!isSigned}
          />

          {!isSigned ? (
            <Button
              variant="primary"
              size="lg"
              onPress={handleSignAgreement}
              loading={loading}
              style={styles.signButton}
            >
              Digitally Sign Agreement
            </Button>
          ) : (
            <View style={styles.signedBadgeRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
              <Text style={styles.signedConfirmText}>Signature on record</Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  successBanner: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 13,
    color: colors.brandDark,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  statusCard: {
    padding: 18,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flex: 1,
    marginRight: 10,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  statusSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  signedTimestampText: {
    fontSize: 12,
    color: colors.brandDark,
    marginTop: 10,
    fontWeight: '600',
  },
  clausesCard: {
    padding: 20,
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  contractIntro: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 18,
  },
  clauseBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  clauseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  clauseContent: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  signatureCard: {
    padding: 20,
  },
  signatureHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  signButton: {
    marginTop: 10,
  },
  signedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  signedConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brandDark,
  },
});
