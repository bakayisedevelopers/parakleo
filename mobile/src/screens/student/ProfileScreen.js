import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clipboard,
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
import { LEGAL_LINKS } from '../../constants/legal';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/ui/FormField';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function ProfileScreen({ navigate }) {
  const { deleteAccount, logout, setUser, user } = useAuth();
  const currentUser = user;
  const studentStatus = getStudentOnboardingStatus(currentUser);
  const hydratedUserIdRef = useRef(null);
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

    let cancelled = false;

    getUserProfile(user.uid).then((profile) => {
      if (cancelled) return;

      const profileData = profile || user;
      if (profile) {
        setUser((prev) => ({ ...prev, ...profile }));
      }

      if (hydratedUserIdRef.current !== user.uid) {
        hydratedUserIdRef.current = user.uid;
        setForm({
          fullName: profileData.fullName || profileData.displayName || '',
          phoneNumber: profileData.phoneNumber || '',
          bio: profileData.bio || '',
          availability: profileData.availability || '',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setUser, user?.uid]);

  const isTutorRole = (currentUser?.activeRole || currentUser?.role) === 'tutor';
  const hasTutorRole = isTutorRole || (currentUser?.roles || []).includes('tutor');
  const referralSlug = String(currentUser?.referralSlug || currentUser?.referralCode || '').trim();
  const referralLink = useMemo(() => {
    return referralSlug ? `https://parakleo.bakayise.com/signup?ref=${encodeURIComponent(referralSlug)}` : '';
  }, [referralSlug]);
  const referralPreview = referralLink.length > 42 ? `${referralLink.slice(0, 42)}...` : referralLink;
  const openLegalUrl = (url) => Linking.openURL(url).catch(() => null);

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

  const handleCopyReferral = () => {
    if (!referralLink) return;
    try {
      Clipboard.setString(referralLink);
      setShareFeedback('Link copied.');
    } catch (_error) {
      setShareFeedback('Unable to copy link.');
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
        <View style={styles.fieldRow}>
          <View style={styles.fieldColumn}>
            <FormField
              label="Full name"
              value={form.fullName}
              onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
              placeholder="Full name"
            />
          </View>
          <View style={styles.fieldColumn}>
            <FormField
              label="Phone number"
              value={form.phoneNumber}
              onChangeText={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
              placeholder="Phone number"
            />
          </View>
        </View>
        <FormField
          label="Bio"
          multiline
          numberOfLines={3}
          value={form.bio}
          onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
          placeholder="Bio"
          inputStyle={styles.bioInput}
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
          <View style={styles.detailItem}>
            <Text style={styles.metaLabel}>Email</Text>
            <Text style={styles.metaValue}>{currentUser?.email || 'Not set'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.metaLabel}>Role</Text>
            <Text style={[styles.metaValue, styles.capitalize]}>{currentUser?.activeRole || currentUser?.role || 'student'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.metaLabel}>Student onboarding</Text>
            <Text style={styles.meta}>{studentStatus.complete ? 'Complete' : studentStatus.message}</Text>
          </View>
          {hasTutorRole ? (
            <View style={styles.detailItem}>
              <Text style={styles.metaLabel}>Tutor onboarding</Text>
              <Text style={styles.meta}>Open the web app to complete tutor-specific setup.</Text>
            </View>
          ) : null}
        </View>
      </Card>

      {(currentUser?.activeRole || currentUser?.role) === 'student' ? (
        <Card style={styles.referralCard}>
          <Text style={styles.referralIntro}>
            Get free 30 minutes when a student joins and completes their profile using your link.
          </Text>
          <View style={styles.referralLinkCard}>
            <Text style={styles.referralLabel}>Referral link</Text>
            <Text style={styles.referralPreview} numberOfLines={2}>{referralPreview || 'Not available yet'}</Text>
            <Text selectable style={styles.referralLink}>{referralLink || 'Not available yet'}</Text>
          </View>
          <View style={styles.referralActions}>
            <Pressable accessibilityRole="button" onPress={handleCopyReferral} style={styles.referralGhostButton}>
              <Text style={styles.referralGhostButtonText}>Copy</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleShareReferral} style={styles.referralShareButton}>
              <Text style={styles.referralShareButtonText}>Share</Text>
            </Pressable>
          </View>
          {shareFeedback ? <Text style={styles.referralFeedback}>{shareFeedback}</Text> : null}
          <Text style={styles.meta}><Text style={styles.metaStrong}>Free minutes remaining:</Text> {Number(currentUser?.freeMinutesRemaining || 0).toFixed(2)} min</Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Legal policies</Text>
        <Text style={styles.copy}>Open the latest terms and policy documents hosted on the web app.</Text>
        <View style={styles.legalList}>
          {LEGAL_LINKS.map((link) => (
            <Pressable key={link.href} onPress={() => openLegalUrl(link.href)} style={styles.legalLink}>
              <Text style={styles.legalLinkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Delete account</Text>
        <Text style={styles.copy}>This permanently removes your profile and access.</Text>
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
    gap: 16,
    paddingBottom: 28,
  },
  header: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  card: {
    gap: 14,
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
  fieldRow: {
    gap: 12,
  },
  fieldColumn: {
    flex: 1,
  },
  bioInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  accountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailGrid: {
    gap: 12,
  },
  legalList: {
    gap: 10,
  },
  legalLink: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.18)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  legalLinkText: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '800',
  },
  detailItem: {
    gap: 4,
  },
  meta: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  capitalize: {
    textTransform: 'capitalize',
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
  metaStrong: {
    color: colors.text,
    fontWeight: '800',
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
