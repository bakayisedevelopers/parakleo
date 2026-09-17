import { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { isTutorAgreementCurrent } from '../../constants/onboarding';
import {
  DEFAULT_TUTOR_AGREEMENT_CLAUSES,
  LEGAL_ENTITY_NAME,
  TUTOR_AGREEMENT_DEFAULT_VERSION,
} from '../../services/legalAgreementService';
import { colors } from '../../theme/colors';

export function TutorLegalScreen({ navigate, goBack }) {
  const { user } = useAuth();
  const isSigned = useMemo(() => isTutorAgreementCurrent(user), [user]);
  const signedDate = user?.agreements?.tutorAgreementSignedAt || user?.tutorAgreement?.acceptedAt;

  const formattedDate = useMemo(() => {
    if (!signedDate) return null;
    const d = typeof signedDate?.toDate === 'function' ? signedDate.toDate() : new Date(signedDate);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  }, [signedDate]);

  return (
    <View style={styles.safeArea}>
      <Header
        title="Legal & Agreements"
        subtitle="Terms, contracts, and regulatory compliance"
        onBack={goBack}
        backIconName="chevron-back"
        transparentBackButton
        rightElement={
          <Pressable
            onPress={() => navigate('Notifications')}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="notifications-outline" size={20} color="#18181b" />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusHeading}>Tutor Service Agreement</Text>
              <Text style={styles.versionText}>Version {TUTOR_AGREEMENT_DEFAULT_VERSION}</Text>
            </View>
            <Badge variant={isSigned ? 'emerald' : 'amber'}>
              {isSigned ? 'Signed & Active' : 'Action Required'}
            </Badge>
          </View>

          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contracting Party:</Text>
              <Text style={styles.metaVal}>{LEGAL_ENTITY_NAME}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Digital Signature:</Text>
              <Text style={styles.metaVal}>
                {isSigned ? user?.fullName || user?.displayName || 'Signed' : 'Not Signed'}
              </Text>
            </View>
            {formattedDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date Executed:</Text>
                <Text style={styles.metaVal}>{formattedDate}</Text>
              </View>
            ) : null}
          </View>

          <Button
            variant="primary"
            size="md"
            onPress={() => navigate('Agreement')}
            style={styles.viewAgreementBtn}
          >
            <Ionicons name="document-text-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            {isSigned ? 'Review Full Signed Agreement' : 'Review & Sign Agreement'}
          </Button>
        </Card>

        {/* Legal Policies Cards */}
        <Text style={styles.sectionHeader}>Platform Policies & Guidelines</Text>

        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.policyTitleBox}>
              <Text style={styles.policyTitle}>Student Safety & Code of Conduct</Text>
              <Text style={styles.policySub}>Child protection and professional boundaries</Text>
            </View>
          </View>
          <Text style={styles.policyText}>
            Parakleo maintains a zero-tolerance policy for harassment, inappropriate off-platform contact, or misconduct. Tutors must conduct all communication and sessions within the Parakleo platform.
          </Text>
        </Card>

        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.policyTitleBox}>
              <Text style={styles.policyTitle}>Privacy & POPIA Compliance</Text>
              <Text style={styles.policySub}>Protection of Personal Information Act</Text>
            </View>
          </View>
          <Text style={styles.policyText}>
            Student data, school records, and session information must remain strictly confidential. Tutors may not copy, distribute, or retain personal student information outside educational lesson delivery.
          </Text>
        </Card>

        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="cash" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.policyTitleBox}>
              <Text style={styles.policyTitle}>Payout & Commission Terms</Text>
              <Text style={styles.policySub}>73% tutor split & weekly disbursements</Text>
            </View>
          </View>
          <Text style={styles.policyText}>
            Tutors receive 73% of billable lesson time and 100% of approved travel surcharges. Payouts are transferred weekly to your verified South African bank account. Direct offline payments from students are prohibited.
          </Text>
        </Card>

        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="briefcase" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.policyTitleBox}>
              <Text style={styles.policyTitle}>Independent Contractor Status</Text>
              <Text style={styles.policySub}>Self-employed status and tax obligations</Text>
            </View>
          </View>
          <Text style={styles.policyText}>
            Tutors operate as independent service providers. You maintain full autonomy over which session requests you accept and are responsible for declaring personal income taxes to SARS.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusInfo: {
    flex: 1,
  },
  statusHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  viewAgreementBtn: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  policyCard: {
    padding: 16,
    marginBottom: 12,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyTitleBox: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  policySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  policyText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
});
