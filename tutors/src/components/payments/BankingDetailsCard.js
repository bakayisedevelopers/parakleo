import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';

export function BankingDetailsCard({ bankingDetails, onEdit }) {
  const isConfigured = Boolean(bankingDetails?.accountNumber);
  const isVerified = bankingDetails?.verified !== false;

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="wallet-outline" size={22} color={colors.brandDark} />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.title}>Direct Payout Account</Text>
          <Text style={styles.subtitle}>South African Banking Details</Text>
        </View>
        <Badge variant={isVerified && isConfigured ? 'emerald' : 'amber'}>
          {isVerified && isConfigured ? 'Verified' : isConfigured ? 'Pending Check' : 'Action Needed'}
        </Badge>
      </View>

      {isConfigured ? (
        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank Name</Text>
            <Text style={styles.detailValue}>{bankingDetails.bankName || 'Capitec Bank'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Holder</Text>
            <Text style={styles.detailValue}>{bankingDetails.accountHolder || 'Tutor'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Number</Text>
            <Text style={styles.detailValue}>
              •••• {String(bankingDetails.accountNumber).slice(-4)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.unconfiguredBox}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.amber} />
          <Text style={styles.unconfiguredText}>
            You have not configured a bank account yet. Add banking details to receive your weekly earnings.
          </Text>
        </View>
      )}

      <Pressable onPress={onEdit} style={styles.editBtn}>
        <Text style={styles.editBtnText}>{isConfigured ? 'Update Bank Account' : 'Set Up Bank Account'}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.brandDark} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  unconfiguredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberLight,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  unconfiguredText: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
    lineHeight: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brandDark,
  },
});
