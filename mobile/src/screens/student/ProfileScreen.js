import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/ui/FormField';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function ProfileScreen({ navigate }) {
  const { deleteAccount, logout, setUser, user } = useAuth();
  const currentUser = user;
  const studentStatus = getStudentOnboardingStatus(currentUser);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    availability: '',
  });

  useEffect(() => {
    if (!user?.uid) return;

    getUserProfile(user.uid).then((profile) => {
      const profileData = profile || user;
      if (profile) {
        setUser((prev) => ({ ...prev, ...profile }));
      }
      setForm({
        fullName: profileData.fullName || profileData.displayName || '',
        phoneNumber: profileData.phoneNumber || '',
        bio: profileData.bio || '',
        availability: profileData.availability || '',
      });
    });
  }, [setUser, user]);

  const isTutorRole = (currentUser?.activeRole || currentUser?.role) === 'tutor';
  const referralSlug = String(currentUser?.referralSlug || currentUser?.referralCode || '').trim();
  const referralLink = useMemo(
    () => (referralSlug ? `https://parakleo.bakayise.com/signup?ref=${encodeURIComponent(referralSlug)}` : ''),
    [referralSlug],
  );
  const referralPreview = referralLink.length > 42 ? `${referralLink.slice(0, 42)}...` : referralLink;

  const handleLogout = async () => {
    await logout();
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    setMessage('');
    try {
      const updates = {
        fullName: form.fullName,
        displayName: form.fullName,
        phoneNumber: form.phoneNumber,
        bio: form.bio,
        availability: form.availability,
      };
      const profile = await updateUserProfile(user.uid, updates);
      setUser((prev) => ({ ...prev, ...profile }));
      setMessage('Profile details saved.');
    } catch (error) {
      setMessage(error.message || 'Unable to save profile right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setMessage('Type DELETE to confirm account deletion.');
      return;
    }
    try {
      setIsDeleting(true);
      await deleteAccount(user.uid);
      setUser(null);
    } catch (error) {
      setMessage(error.message || 'Unable to delete account. You may need to sign in again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareReferral = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        title: 'Join Parakleo',
        message: `Use my Parakleo referral link to sign up and start learning.\n${referralLink}`,
        url: referralLink,
      });
      setShareFeedback('Link shared.');
    } catch (_error) {
      setShareFeedback('Unable to share link.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile & Settings</Text>
        <Text style={styles.copy}>Manage your account, profile details, and onboarding progress in one place.</Text>
      </View>

      {!studentStatus.complete ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Complete profile</Text>
          <Text style={styles.copy}>Finish required onboarding details before requesting classes or teaching online.</Text>
          <Button onPress={() => navigate('Onboarding')}>Open complete profile</Button>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <FormField
          label="Full name"
          value={form.fullName}
          onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
          placeholder="Full name"
        />
        <FormField
          label="Phone number"
          value={form.phoneNumber}
          onChangeText={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
          placeholder="Phone number"
        />
        <FormField
          label="Bio"
          multiline
          numberOfLines={3}
          value={form.bio}
          onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
          placeholder="Bio"
        />
        {isTutorRole ? (
          <FormField
            label="Availability"
            value={form.availability}
            onChangeText={(value) => setForm((prev) => ({ ...prev, availability: value }))}
            placeholder="Weekdays after 5pm"
          />
        ) : null}
        <Button disabled={isSaving} onPress={handleSave}>
          {isSaving ? 'Saving...' : 'Save profile'}
        </Button>
      </Card>

      <Card style={styles.card}>
        <View style={styles.accountHeader}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Button variant="secondary" onPress={handleLogout}>Log out</Button>
        </View>
        <View style={styles.detailGrid}>
          <Text style={styles.meta}><Text style={styles.metaLabel}>Email:</Text> {currentUser?.email || 'Not set'}</Text>
          <Text style={styles.meta}><Text style={styles.metaLabel}>Role:</Text> {currentUser?.activeRole || currentUser?.role || 'student'}</Text>
          <Text style={styles.meta}><Text style={styles.metaLabel}>Student onboarding:</Text> {studentStatus.complete ? 'Complete' : studentStatus.message}</Text>
        </View>
      </Card>

      {(currentUser?.activeRole || currentUser?.role) === 'student' && referralLink ? (
        <Card style={styles.referralCard}>
          <Text style={styles.referralIntro}>
            Get free 30 minutes when a student joins and completes their profile using your link.
          </Text>
          <View style={styles.referralLinkCard}>
            <Text style={styles.referralLabel}>Referral link</Text>
            <Text style={styles.referralPreview} numberOfLines={2}>{referralPreview}</Text>
            <Text selectable style={styles.referralLink}>{referralLink}</Text>
          </View>
          <View style={styles.referralActions}>
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(referralLink)} style={styles.referralGhostButton}>
              <Text style={styles.referralGhostButtonText}>Open</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleShareReferral} style={styles.referralShareButton}>
              <Text style={styles.referralShareButtonText}>Share</Text>
            </Pressable>
          </View>
          {shareFeedback ? <Text style={styles.referralFeedback}>{shareFeedback}</Text> : null}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Delete account</Text>
        <Text style={styles.danger}>Type DELETE below to confirm permanent account deletion.</Text>
        <TextInput
          placeholder="Type DELETE"
          placeholderTextColor={colors.muted}
          style={styles.deleteInput}
          value={confirmText}
          onChangeText={setConfirmText}
        />
        <Button variant="secondary" disabled={isDeleting} onPress={handleDelete}>
          {isDeleting ? 'Deleting account...' : 'Delete my account'}
        </Button>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingBottom: 24,
  },
  header: {
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  card: {
    gap: 10,
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailGrid: {
    gap: 8,
  },
  meta: {
    color: colors.text,
    fontSize: 14,
  },
  metaLabel: {
    color: colors.muted,
    fontWeight: '800',
  },
  referralCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
    gap: 10,
  },
  referralIntro: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 22,
  },
  referralLinkCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: '#bbf7d0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  referralLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  referralPreview: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '700',
  },
  referralLink: {
    color: '#52525b',
    fontSize: 11,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 8,
  },
  referralGhostButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  referralGhostButtonText: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '800',
  },
  referralShareButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 10,
  },
  referralShareButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  referralFeedback: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  danger: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  message: {
    color: colors.text,
    fontSize: 13,
  },
});
