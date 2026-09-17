import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LEGAL_LINKS } from '../../constants/legal';
import { GUARDIAN_RELATIONSHIPS, GENDER_OPTIONS } from '../../constants/safety';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'Tertiary'];

export function ProfileScreen({ navigate, goBack }) {
  const { deleteAccount, logout, setUser, user } = useAuth();
  const currentUser = user || {};
  const studentStatus = getStudentOnboardingStatus(currentUser);
  const hydratedUserIdRef = useRef(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Safety & Guardian Mode State (REQ-011)
  const existingSafety = currentUser?.studentProfile?.safety || currentUser?.safety || {};
  const [safetyLearnerType, setSafetyLearnerType] = useState(existingSafety.learnerType || (existingSafety.isMinor ? 'minor' : 'adult'));
  const [safetyGuardianName, setSafetyGuardianName] = useState(existingSafety.guardian?.name || '');
  const [safetyGuardianRelationship, setSafetyGuardianRelationship] = useState(existingSafety.guardian?.relationship || 'Parent');
  const [safetyGuardianPhone, setSafetyGuardianPhone] = useState(existingSafety.guardian?.phoneNumber || '');
  const [safetyGuardianEmail, setSafetyGuardianEmail] = useState(existingSafety.guardian?.email || '');
  const [safetyGuardianConsentAccepted, setSafetyGuardianConsentAccepted] = useState(Boolean(existingSafety.guardian?.consentAcceptedAt));
  const [safetyPreferSameGender, setSafetyPreferSameGender] = useState(Boolean(existingSafety.preferences?.preferSameGenderTutor));
  const [safetyPreferPublicPlace, setSafetyPreferPublicPlace] = useState(Boolean(existingSafety.preferences?.preferPublicMeetingPlace));
  const [safetyGender, setSafetyGender] = useState(currentUser?.gender || existingSafety.gender || '');

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    homeAddress: '',
    grade: '',
  });

  const studentName = currentUser?.fullName || currentUser?.displayName || 'Student';
  const studentEmail = currentUser?.email || 'No email provided';
  const photoUri = currentUser?.selfieUrl || currentUser?.profilePhoto || currentUser?.photoURL || '';
  const freeMinutes = Number(currentUser?.freeMinutesRemaining || 0).toFixed(0);

  const referralSlug = String(currentUser?.referralSlug || currentUser?.referralCode || '').trim();
  const referralLink = useMemo(() => {
    return referralSlug ? `https://parakleo.bakayise.com/signup?ref=${encodeURIComponent(referralSlug)}` : '';
  }, [referralSlug]);

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
          homeAddress: profileData.homeAddress || profileData.address || '',
          grade: String(profileData.studentProfile?.grade || profileData.grade || ''),
        });
        const s = profileData.studentProfile?.safety || profileData.safety || {};
        setSafetyLearnerType(s.learnerType || (s.isMinor ? 'minor' : 'adult'));
        setSafetyGuardianName(s.guardian?.name || '');
        setSafetyGuardianRelationship(s.guardian?.relationship || 'Parent');
        setSafetyGuardianPhone(s.guardian?.phoneNumber || '');
        setSafetyGuardianEmail(s.guardian?.email || '');
        setSafetyGuardianConsentAccepted(Boolean(s.guardian?.consentAcceptedAt));
        setSafetyPreferSameGender(Boolean(s.preferences?.preferSameGenderTutor));
        setSafetyPreferPublicPlace(Boolean(s.preferences?.preferPublicMeetingPlace));
        setSafetyGender(profileData.gender || s.gender || '');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setUser, user?.uid]);

  const getInitials = () => {
    const parts = String(studentName).trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return studentName.charAt(0).toUpperCase() || 'S';
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Parakleo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    setMessage('');
    try {
      const resolvedGrade = form.grade ? (Number(form.grade) || form.grade) : null;
      const cleanAddress = form.homeAddress.trim();
      const updates = {
        fullName: form.fullName,
        displayName: form.fullName,
        phoneNumber: form.phoneNumber,
        bio: form.bio,
        homeAddress: cleanAddress,
        address: cleanAddress,
        grade: resolvedGrade,
        studentProfile: {
          ...(user?.studentProfile || {}),
          grade: resolvedGrade,
        },
      };
      const profile = await updateUserProfile(user.uid, updates);
      setUser((prev) => ({
        ...prev,
        ...profile,
        homeAddress: cleanAddress,
        address: cleanAddress,
        grade: resolvedGrade,
        studentProfile: {
          ...(prev?.studentProfile || {}),
          grade: resolvedGrade,
        },
      }));
      setMessage('Profile updated successfully.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setMessage('');
      }, 800);
    } catch (error) {
      setMessage(error.message || 'Unable to save profile right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSafetyProfile = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    setMessage('');
    try {
      const isMinor = safetyLearnerType === 'minor';
      const cleanGender = safetyGender.trim().toLowerCase();
      const updates = {
        gender: cleanGender,
        studentProfile: {
          ...(user?.studentProfile || {}),
          gender: cleanGender,
          safety: {
            learnerType: isMinor ? 'minor' : 'adult',
            isMinor,
            guardian: isMinor ? {
              name: safetyGuardianName.trim(),
              relationship: safetyGuardianRelationship.trim(),
              phoneNumber: safetyGuardianPhone.trim(),
              email: safetyGuardianEmail.trim(),
              consentAcceptedAt: safetyGuardianConsentAccepted ? (existingSafety.guardian?.consentAcceptedAt || new Date().toISOString()) : null,
            } : {
              name: '',
              relationship: '',
              phoneNumber: '',
              email: '',
              consentAcceptedAt: null,
            },
            preferences: {
              preferSameGenderTutor: Boolean(safetyPreferSameGender),
              preferPublicMeetingPlace: Boolean(safetyPreferPublicPlace),
              guardianPresenceRequired: isMinor,
            },
          },
        },
      };
      const profile = await updateUserProfile(user.uid, updates);
      setUser((prev) => ({ ...prev, ...profile }));
      setMessage('Safety and guardian settings updated successfully.');
      setTimeout(() => {
        setIsSafetyModalOpen(false);
        setMessage('');
      }, 800);
    } catch (error) {
      setMessage(error.message || 'Unable to update safety profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
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
      setShareFeedback('Link copied to clipboard.');
    } catch (_error) {
      setShareFeedback('Unable to copy link.');
    }
  };

  const openLegalUrl = (url) => Linking.openURL(url).catch(() => null);

  return (
    <View style={styles.container}>
      {/* AVATAR & STUDENT STATUS HERO CARD */}
      <Card style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{getInitials()}</Text>
            </View>
          )}
          <View style={[styles.statusDot, styles.statusOnline]} />
        </View>

        <Text style={styles.nameText}>{studentName}</Text>
        <Text style={styles.emailText}>{studentEmail}</Text>

        <View style={styles.badgeRow}>
          <Badge variant="emerald">Verified Student</Badge>
          <Badge variant={studentStatus.complete ? 'emerald' : 'amber'}>
            {studentStatus.complete ? 'Profile Complete' : 'Profile Incomplete'}
          </Badge>
          {Number(freeMinutes) > 0 ? (
            <Badge variant="sky">{freeMinutes} Free Min</Badge>
          ) : null}
        </View>
      </Card>

      {/* NAVIGATION SETTINGS MENU */}
      <Text style={styles.menuSectionHeader}>Preferences & Management</Text>
      <Card style={styles.navMenuCard}>
        {/* Account & Personal Details */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMessage('');
            setIsEditModalOpen(true);
          }}
          style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
        >
          <View style={styles.navIconCircle}>
            <Ionicons name="person-outline" size={20} color={colors.brandDark} />
          </View>
          <View style={styles.navItemContent}>
            <Text style={styles.navItemTitle}>Account & Personal Details</Text>
            <Text style={styles.navItemSubtitle}>Name, phone number, and student bio</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        {/* Referrals & Free Minutes */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setShareFeedback('');
            setIsReferralModalOpen(true);
          }}
          style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
        >
          <View style={styles.navIconCircle}>
            <Ionicons name="gift-outline" size={20} color={colors.brandDark} />
          </View>
          <View style={styles.navItemContent}>
            <Text style={styles.navItemTitle}>Referrals & Free Minutes</Text>
            <Text style={styles.navItemSubtitle}>Invite friends to earn free learning minutes</Text>
          </View>
          <Badge variant="emerald" style={{ marginRight: 6 }}>
            {freeMinutes} min
          </Badge>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        {/* Safety Profile & Guardian Mode (REQ-011) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMessage('');
            setIsSafetyModalOpen(true);
          }}
          style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
        >
          <View style={styles.navIconCircle}>
            <Ionicons name="shield-outline" size={20} color={colors.brandDark} />
          </View>
          <View style={styles.navItemContent}>
            <Text style={styles.navItemTitle}>Safety Profile & Guardian Mode</Text>
            <Text style={styles.navItemSubtitle}>
              {currentUser?.studentProfile?.safety?.learnerType === 'minor'
                ? `Minor Learner • Guardian: ${currentUser?.studentProfile?.safety?.guardian?.name || 'Required'}`
                : 'Adult Learner • Safety preferences'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        {/* Legal & Platform Policies */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsLegalModalOpen(true)}
          style={({ pressed }) => [
            styles.navItem,
            studentStatus.complete && styles.navItemLast,
            pressed && styles.navItemPressed,
          ]}
        >
          <View style={styles.navIconCircle}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.brandDark} />
          </View>
          <View style={styles.navItemContent}>
            <Text style={styles.navItemTitle}>Legal & Platform Policies</Text>
            <Text style={styles.navItemSubtitle}>Terms of service, privacy, and safety</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        {/* Incomplete Onboarding Warning (if applicable) */}
        {!studentStatus.complete ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate('Onboarding')}
            style={({ pressed }) => [styles.navItem, styles.navItemLast, pressed && styles.navItemPressed]}
          >
            <View style={styles.navIconCircleWarning}>
              <Ionicons name="sparkles-outline" size={20} color="#b45309" />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>Complete Profile</Text>
              <Text style={styles.navItemSubtitle}>{studentStatus.message || 'Finish required onboarding details'}</Text>
            </View>
            <Badge variant="amber" style={{ marginRight: 6 }}>
              Action Required
            </Badge>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
      </Card>

      {/* LOGOUT BUTTON */}
      <View style={styles.logoutContainer}>
        <Button
          variant="secondary"
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
          Sign Out
        </Button>
      </View>

      {/* DANGER ZONE - DELETE ACCOUNT */}
      <View style={styles.dangerZone}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setConfirmText('');
            setMessage('');
            setIsDeleteModalOpen(true);
          }}
          style={styles.deleteLink}
        >
          <Ionicons name="trash-outline" size={15} color={colors.danger} />
          <Text style={styles.deleteLinkText}>Delete Account</Text>
        </Pressable>
      </View>

      {/* MODAL 1: EDIT PERSONAL DETAILS */}
      <Modal
        animationType="slide"
        transparent
        visible={isEditModalOpen}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalScrim} onPress={() => setIsEditModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personal Details</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <FormField
                label="Full Name"
                value={form.fullName}
                onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
                placeholder="Your full name"
              />
              <FormField
                label="Phone Number"
                value={form.phoneNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
              <FormField
                label="Home Address"
                value={form.homeAddress}
                onChangeText={(value) => setForm((prev) => ({ ...prev, homeAddress: value }))}
                placeholder="e.g. 123 Main Street, Pretoria"
              />

              <View style={styles.gradeSection}>
                <Text style={styles.gradeSectionLabel}>Grade / School Level</Text>
                <View style={styles.gradeGrid}>
                  {GRADE_OPTIONS.map((g) => {
                    const isSelected = String(form.grade) === String(g);
                    return (
                      <Pressable
                        key={g}
                        accessibilityRole="button"
                        onPress={() => setForm((prev) => ({ ...prev, grade: isSelected ? '' : g }))}
                        style={[styles.gradeChip, isSelected && styles.gradeChipSelected]}
                      >
                        <Text style={[styles.gradeChipText, isSelected && styles.gradeChipTextSelected]}>
                          {isNaN(Number(g)) ? g : `Grade ${g}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <FormField
                label="Student Bio"
                multiline
                numberOfLines={3}
                value={form.bio}
                onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
                placeholder="Share a short bio or what you are studying"
                inputStyle={styles.bioInput}
              />

              {message ? (
                <View style={message.includes('success') ? styles.feedbackSuccess : styles.feedbackError}>
                  <Text style={message.includes('success') ? styles.feedbackSuccessText : styles.feedbackErrorText}>
                    {message}
                  </Text>
                </View>
              ) : null}

              <Button
                disabled={isSaving}
                onPress={handleSaveProfile}
                style={styles.modalPrimaryButton}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: REFERRALS & FREE MINUTES */}
      <Modal
        animationType="slide"
        transparent
        visible={isReferralModalOpen}
        onRequestClose={() => setIsReferralModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalScrim} onPress={() => setIsReferralModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Referrals & Free Minutes</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsReferralModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.referralHeroBox}>
                <View style={styles.referralIconWrap}>
                  <Ionicons name="gift" size={28} color="#047857" />
                </View>
                <Text style={styles.referralHeroTitle}>Earn Free Learning Minutes</Text>
                <Text style={styles.referralHeroCopy}>
                  Invite a classmate or friend to Parakleo. When they join and complete their profile, you receive 15 free minutes.
                </Text>
                <View style={styles.balancePill}>
                  <Text style={styles.balancePillLabel}>Free Minutes Balance:</Text>
                  <Text style={styles.balancePillValue}>{freeMinutes} min</Text>
                </View>
              </View>

              <View style={styles.linkCard}>
                <Text style={styles.linkLabel}>Your Referral Link</Text>
                <Text selectable style={styles.linkUrl}>
                  {referralLink || 'Generating your unique link...'}
                </Text>
              </View>

              <View style={styles.referralActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleCopyReferral}
                  style={styles.referralGhostButton}
                >
                  <Ionicons name="copy-outline" size={18} color="#3f3f46" />
                  <Text style={styles.referralGhostButtonText}>Copy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleShareReferral}
                  style={styles.referralShareButton}
                >
                  <Ionicons name="share-social-outline" size={18} color="#ffffff" />
                  <Text style={styles.referralShareButtonText}>Share</Text>
                </Pressable>
              </View>

              {shareFeedback ? (
                <Text style={styles.shareFeedback}>{shareFeedback}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: LEGAL POLICIES */}
      <Modal
        animationType="slide"
        transparent
        visible={isLegalModalOpen}
        onRequestClose={() => setIsLegalModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalScrim} onPress={() => setIsLegalModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Legal & Policies</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsLegalModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalSubtitle}>
                Read our official platform terms, privacy protocols, and student usage guidelines.
              </Text>
              <View style={styles.legalList}>
                {LEGAL_LINKS.map((link) => (
                  <Pressable
                    key={link.href}
                    onPress={() => openLegalUrl(link.href)}
                    style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
                  >
                    <Text style={styles.legalLinkText}>{link.label}</Text>
                    <Ionicons name="open-outline" size={18} color={colors.brandDark} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: SAFETY PROFILE & GUARDIAN MODE (REQ-011) */}
      <Modal
        animationType="slide"
        transparent
        visible={isSafetyModalOpen}
        onRequestClose={() => setIsSafetyModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalScrim} onPress={() => setIsSafetyModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={22} color="#059669" />
                <Text style={styles.modalTitle}>Safety & Guardian Mode</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsSafetyModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalSubtitle}>
                Manage your learner safety profile, guardian details, and tutor matching preferences.
              </Text>

              {message ? (
                <View style={styles.modalMessageBanner}>
                  <Text style={styles.modalMessageText}>{message}</Text>
                </View>
              ) : null}

              {/* Learner Category Toggle */}
              <Text style={styles.fieldSectionLabel}>Learner Category</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSafetyLearnerType('adult')}
                  style={[styles.toggleBtn, safetyLearnerType === 'adult' && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleBtnText, safetyLearnerType === 'adult' && styles.toggleBtnTextActive]}>
                    Adult Learner (18+)
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSafetyLearnerType('minor')}
                  style={[styles.toggleBtn, safetyLearnerType === 'minor' && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleBtnText, safetyLearnerType === 'minor' && styles.toggleBtnTextActive]}>
                    Minor Learner (&lt;18)
                  </Text>
                </Pressable>
              </View>

              {safetyLearnerType === 'minor' ? (
                <View style={styles.minorNoticeBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#b45309" />
                  <Text style={styles.minorNoticeText}>
                    A parent or designated guardian must be present on site during in-person tutoring sessions.
                  </Text>
                </View>
              ) : null}

              {safetyLearnerType === 'minor' ? (
                <>
                  <FormField
                    label="Parent / Guardian Full Name *"
                    value={safetyGuardianName}
                    onChangeText={setSafetyGuardianName}
                    placeholder="e.g. Sarah Mokoena"
                  />
                  <FormField
                    label="Relationship to Learner *"
                    value={safetyGuardianRelationship}
                    onChangeText={setSafetyGuardianRelationship}
                    placeholder="e.g. Parent, Legal Guardian"
                  />
                  <FormField
                    label="Guardian Phone Number *"
                    keyboardType="phone-pad"
                    value={safetyGuardianPhone}
                    onChangeText={setSafetyGuardianPhone}
                    placeholder="e.g. 082 123 4567"
                  />
                  <FormField
                    label="Guardian Email (Optional)"
                    keyboardType="email-address"
                    value={safetyGuardianEmail}
                    onChangeText={setSafetyGuardianEmail}
                    placeholder="guardian@example.com"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSafetyGuardianConsentAccepted((prev) => !prev)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={safetyGuardianConsentAccepted ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={safetyGuardianConsentAccepted ? '#059669' : colors.muted}
                    />
                    <Text style={styles.checkboxText}>
                      I confirm parent/guardian consent and in-person presence for all sessions.
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* Safety Preferences */}
              <Text style={[styles.fieldSectionLabel, { marginTop: 12 }]}>Safety & Matching Preferences</Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => setSafetyPreferPublicPlace((prev) => !prev)}
                style={styles.checkboxRow}
              >
                <Ionicons
                  name={safetyPreferPublicPlace ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={safetyPreferPublicPlace ? '#059669' : colors.muted}
                />
                <Text style={styles.checkboxText}>
                  Prefer public meeting place (library, coffee shop, campus)
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setSafetyPreferSameGender((prev) => !prev)}
                style={styles.checkboxRow}
              >
                <Ionicons
                  name={safetyPreferSameGender ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={safetyPreferSameGender ? '#059669' : colors.muted}
                />
                <Text style={styles.checkboxText}>
                  Prefer same-gender tutor (soft matching preference; all verified tutors available as fallback)
                </Text>
              </Pressable>

              <Text style={styles.fieldSectionLabel}>Learner Gender (Optional for matching)</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => (
                  <Pressable
                    accessibilityRole="button"
                    key={opt.value}
                    onPress={() => setSafetyGender(opt.value)}
                    style={[styles.genderChip, safetyGender === opt.value && styles.genderChipActive]}
                  >
                    <Text style={[styles.genderChipText, safetyGender === opt.value && styles.genderChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Button
                  disabled={
                    isSaving ||
                    (safetyLearnerType === 'minor' &&
                      (!safetyGuardianName.trim() ||
                        !safetyGuardianRelationship.trim() ||
                        !safetyGuardianPhone.trim() ||
                        !safetyGuardianConsentAccepted))
                  }
                  onPress={handleSaveSafetyProfile}
                  style={styles.saveModalButton}
                >
                  {isSaving ? 'Saving Changes...' : 'Save Safety Profile'}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: DELETE ACCOUNT */}
      <Modal
        animationType="fade"
        transparent
        visible={isDeleteModalOpen}
        onRequestClose={() => setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalScrim} onPress={() => setIsDeleteModalOpen(false)} />
          <View style={styles.modalAlert}>
            <View style={styles.modalHeader}>
              <Text style={styles.deleteModalTitle}>Delete Account</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsDeleteModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <Text style={styles.deleteWarning}>
              This will permanently delete your account, session records, and payment history. This action cannot be undone.
            </Text>
            <Text style={styles.deleteInstruction}>Type DELETE to confirm:</Text>
            <TextInput
              placeholder="Type DELETE"
              placeholderTextColor={colors.muted}
              style={styles.deleteInput}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
            />
            {message ? <Text style={styles.messageDanger}>{message}</Text> : null}

            <View style={styles.deleteActions}>
              <Button
                variant="secondary"
                onPress={() => setIsDeleteModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                disabled={isDeleting || confirmText !== 'DELETE'}
                onPress={handleDeleteAccount}
                style={[styles.deleteButtonConfirm, confirmText !== 'DELETE' && { opacity: 0.5 }]}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 28,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    marginBottom: 4,
    paddingVertical: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  avatarContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    borderColor: '#10b981',
    borderRadius: 40,
    borderWidth: 2,
    height: 80,
    width: 80,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 40,
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  avatarInitial: {
    color: '#047857',
    fontSize: 26,
    fontWeight: '900',
  },
  statusDot: {
    borderColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 2,
    bottom: 2,
    height: 18,
    position: 'absolute',
    right: 2,
    width: 18,
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  nameText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  emailText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  menuSectionHeader: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  navMenuCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    marginBottom: 8,
    overflow: 'hidden',
    padding: 0,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  navItem: {
    alignItems: 'center',
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navItemLast: {
    borderBottomWidth: 0,
  },
  navItemPressed: {
    backgroundColor: '#f8fafc',
  },
  navIconCircle: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    marginRight: 14,
    width: 38,
  },
  navIconCircleWarning: {
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    marginRight: 14,
    width: 38,
  },
  navItemContent: {
    flex: 1,
  },
  navItemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  navItemSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
  },
  logoutContainer: {
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    width: '100%',
  },
  dangerZone: {
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 8,
  },
  deleteLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    padding: 8,
  },
  deleteLinkText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  bioInput: {
    minHeight: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  // Modals styling
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalAlert: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    padding: 22,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  deleteModalTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalScroll: {
    gap: 14,
    paddingBottom: 16,
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalPrimaryButton: {
    marginTop: 8,
  },
  feedbackSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  feedbackSuccessText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  feedbackErrorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  referralHeroBox: {
    alignItems: 'center',
    backgroundColor: '#dff7ee',
    borderColor: '#bbf7d0',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  referralIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  referralHeroTitle: {
    color: '#047857',
    fontSize: 17,
    fontWeight: '800',
  },
  referralHeroCopy: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  balancePill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  balancePillLabel: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '700',
  },
  balancePillValue: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '900',
  },
  linkCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  linkLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  linkUrl: {
    color: '#0f172a',
    fontSize: 12,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 10,
  },
  referralGhostButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  referralGhostButtonText: {
    color: '#3f3f46',
    fontSize: 14,
    fontWeight: '700',
  },
  referralShareButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  referralShareButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  shareFeedback: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  legalList: {
    gap: 10,
    marginTop: 6,
  },
  legalLink: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legalLinkPressed: {
    backgroundColor: '#dcfce7',
  },
  legalLinkText: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteWarning: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  deleteInstruction: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  deleteInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageDanger: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  deleteButtonConfirm: {
    backgroundColor: colors.danger,
    flex: 1,
  },
  gradeSection: {
    marginBottom: 16,
  },
  gradeSectionLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gradeChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  gradeChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  gradeChipTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  fieldSectionLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  toggleBtn: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  toggleBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  toggleBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#065f46',
    fontWeight: '800',
  },
  minorNoticeBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    padding: 10,
  },
  minorNoticeText: {
    color: '#92400e',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  checkboxText: {
    color: '#334155',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  genderChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  genderChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  genderChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalMessageBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
  },
  modalMessageText: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '700',
  },
  saveModalButton: {
    flex: 1,
  },
});
