import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile } from '../../services/userService';
import { getTutorOnboardingStatus } from '../../constants/onboarding';
import { colors } from '../../theme/colors';

export function TutorReviewStatusScreen({ navigate }) {
  const { user, setUser, logout, isVerified, verificationStatus, rejectionReason } = useAuth();
  const [checking, setChecking] = useState(false);
  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user || {}), [user]);

  const isRejected = verificationStatus === 'rejected';

  const handleCheckStatus = async () => {
    if (!user?.uid) return;
    try {
      setChecking(true);
      const refreshed = await getUserProfile(user.uid);
      if (refreshed) {
        setUser((prev) => ({
          ...prev,
          ...refreshed,
          tutorProfile: {
            ...(prev?.tutorProfile || {}),
            ...(refreshed?.tutorProfile || {}),
          },
        }));
        const status = String(
          refreshed?.tutorProfile?.verificationStatus || refreshed?.verificationStatus || 'pending'
        ).toLowerCase();
        if (status === 'verified') {
          Alert.alert(
            'Account Verified!',
            'Congratulations! Your tutor account and right-to-work documents have been approved. You can now go online to receive tutoring requests.',
            [{ text: 'Go to Dashboard', onPress: () => navigate('Dashboard') }]
          );
        } else if (status === 'rejected') {
          Alert.alert(
            'Verification Rejected',
            refreshed?.tutorProfile?.rejectionReason || 'Please review and re-upload your verification documents.'
          );
        } else {
          Alert.alert('Status Pending', 'Your documents are still being reviewed by our compliance team.');
        }
      }
    } catch (err) {
      Alert.alert('Status Check Failed', err?.message || 'Unable to check verification status right now.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Icon & Brand */}
        <View style={styles.heroSection}>
          <View style={[styles.iconCircle, isRejected ? styles.iconCircleDanger : styles.iconCircleAmber]}>
            <Ionicons
              name={isRejected ? 'close-circle' : 'shield-checkmark'}
              size={36}
              color={isRejected ? colors.danger : colors.brandDark}
            />
          </View>
          <Text style={styles.heroTitle}>
            {isRejected ? 'Verification Rejected' : 'Application Under Review'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isRejected
              ? 'Your submitted documents could not be approved by compliance.'
              : 'Your right-to-work documents are undergoing manual review.'}
          </Text>
          <View style={styles.badgeWrapper}>
            <Badge variant={isRejected ? 'rose' : 'amber'}>
              {isRejected ? 'Action Required' : 'Pending Admin Verification'}
            </Badge>
          </View>
        </View>

        {/* Rejection Details & Deletion Policy Banner */}
        {isRejected ? (
          <Card style={styles.rejectionCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="alert-circle" size={22} color={colors.danger} />
              <Text style={styles.rejectionCardTitle}>Rejection Feedback</Text>
            </View>
            <Text style={styles.rejectionReasonText}>
              {rejectionReason || 'The uploaded documents did not meet our verification standards. Please ensure both your police clearance certificate and official South African ID or passport with valid work visa are clear and legible.'}
            </Text>

            {/* Mandatory 24-hour document deletion notice per REQ-007 */}
            <View style={styles.deletionPolicyNotice}>
              <Ionicons name="trash-bin-outline" size={18} color="#991b1b" style={{ marginTop: 2 }} />
              <View style={styles.deletionPolicyTextCol}>
                <Text style={styles.deletionPolicyHeading}>24-Hour Document Deletion Policy</Text>
                <Text style={styles.deletionPolicyBody}>
                  In compliance with POPIA and platform privacy standards, rejected private documents (police clearance and right-to-work ID/passport) are permanently purged from our secure servers within 24 hours of rejection. Please re-upload valid documents promptly to maintain your account.
                </Text>
              </View>
            </View>

            <Button
              variant="primary"
              size="lg"
              onPress={() => navigate('Onboarding', { initialStep: 'clearance' })}
              style={styles.actionBtn}
            >
              Re-upload Documents
            </Button>
          </Card>
        ) : (
          /* Pending Review State: Checklist & Guidance */
          <Card style={styles.checklistCard}>
            <Text style={styles.cardTitle}>Application Verification Checklist</Text>
            <Text style={styles.cardSubtitle}>
              All in-person tutors must be manually vetted before receiving student bookings.
            </Text>

            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasAgreementSigned ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={onboardingStatus.hasAgreementSigned ? colors.brandDark : colors.amber}
                />
                <Text style={styles.checkItemLabel}>Tutor Service Agreement (v1.1.0 signed)</Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasPersonalDetails ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={onboardingStatus.hasPersonalDetails ? colors.brandDark : colors.amber}
                />
                <Text style={styles.checkItemLabel}>Personal Profile & Verified Selfie</Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasSubjects ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={onboardingStatus.hasSubjects ? colors.brandDark : colors.amber}
                />
                <Text style={styles.checkItemLabel}>Academic Results & Qualified Subjects</Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasPoliceClearance ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={onboardingStatus.hasPoliceClearance ? colors.brandDark : colors.danger}
                />
                <Text style={styles.checkItemLabel}>Police Clearance Certificate</Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasRightToWork ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={onboardingStatus.hasRightToWork ? colors.brandDark : colors.danger}
                />
                <Text style={styles.checkItemLabel}>Right-to-Work ID or Passport Document</Text>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={onboardingStatus.hasPayout ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={onboardingStatus.hasPayout ? colors.brandDark : colors.amber}
                />
                <Text style={styles.checkItemLabel}>Bank Account & Payout Setup</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.brandDark} />
              <Text style={styles.infoBoxText}>
                Manual reviews are conducted by our operations team. You cannot toggle your status to online or receive student offers until approval is completed.
              </Text>
            </View>

            <Button
              variant="primary"
              size="lg"
              onPress={handleCheckStatus}
              loading={checking}
              style={styles.actionBtn}
            >
              Check Verification Status
            </Button>
          </Card>
        )}

        {/* Navigation / Logout Footer */}
        <View style={styles.footerRow}>
          <Pressable onPress={() => navigate('Onboarding')} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>View Onboarding Steps</Text>
          </Pressable>
          <Text style={styles.dividerDot}>•</Text>
          <Pressable onPress={handleSignOut} style={styles.secondaryLink}>
            <Text style={styles.signOutLinkText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleAmber: {
    backgroundColor: '#fef3c7',
  },
  iconCircleDanger: {
    backgroundColor: '#fee2e2',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 12,
  },
  badgeWrapper: {
    alignItems: 'center',
  },
  rejectionCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  rejectionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  rejectionReasonText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
    marginBottom: 16,
  },
  deletionPolicyNotice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  deletionPolicyTextCol: {
    flex: 1,
  },
  deletionPolicyHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 4,
  },
  deletionPolicyBody: {
    fontSize: 12,
    color: '#991b1b',
    lineHeight: 17,
  },
  checklistCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  checklist: {
    gap: 12,
    marginBottom: 18,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  secondaryLink: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  secondaryLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brandDark,
  },
  dividerDot: {
    fontSize: 14,
    color: colors.textMuted,
  },
  signOutLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
});
