import { useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { upsertTutorProfile } from '../../services/userService';
import { colors } from '../../theme/colors';

export function TutorAccountScreen({ navigate, goBack }) {
  const { user, setUser, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fullNameParts = String(user?.fullName || user?.displayName || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(user?.firstName || user?.tutorProfile?.firstName || fullNameParts[0] || '');
  const [surname, setSurname] = useState(user?.surname || user?.tutorProfile?.surname || fullNameParts.slice(1).join(' ') || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || user?.tutorProfile?.phone || '');
  const [university, setUniversity] = useState(user?.tutorProfile?.university || '');
  const [degree, setDegree] = useState(user?.tutorProfile?.degree || '');
  const [biography, setBiography] = useState(user?.tutorProfile?.biography || '');

  const tutorProfile = user?.tutorProfile || {};
  const photoUri = user?.selfieUrl || user?.profilePhoto || user?.photoURL || '';

  const getInitials = () => {
    const first = firstName.trim().charAt(0);
    const last = surname.trim().charAt(0);
    if (first || last) return `${first}${last}`.toUpperCase();
    const name = String(user?.fullName || user?.displayName || 'T').trim();
    return name.charAt(0).toUpperCase();
  };

  const handleSave = async () => {
    if (!firstName.trim() || !surname.trim()) {
      setErrorMessage('First name and surname are required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('');

      const fullName = `${firstName.trim()} ${surname.trim()}`.trim();
      const updated = await upsertTutorProfile(user.uid, {
        firstName: firstName.trim(),
        surname: surname.trim(),
        fullName,
        displayName: fullName,
        phoneNumber: phoneNumber.trim(),
        tutorProfile: {
          ...tutorProfile,
          firstName: firstName.trim(),
          surname: surname.trim(),
          phone: phoneNumber.trim(),
          biography: biography.trim(),
          university: university.trim(),
          degree: degree.trim(),
        },
      });

      setUser((prev) => ({ ...prev, ...updated }));
      setStatusMessage('Account details updated successfully.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to update account details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Tutor Account',
      'This will permanently remove your tutor account, subject qualifications, and historical data. This action cannot be undone. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err) {
              Alert.alert('Error', err?.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.safeArea}>
      <Header
        title="Account & Details"
        subtitle="Manage your personal profile and account settings"
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {statusMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.brandDark} />
            <Text style={styles.successBannerText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Profile Avatar Card */}
        <Card style={styles.avatarCard}>
          <View style={styles.avatarContainer}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.onlineBadgeDot} />
          </View>
          <Text style={styles.profileNameText}>
            {firstName && surname ? `${firstName} ${surname}` : user?.fullName || 'Tutor'}
          </Text>
          <Text style={styles.profileEmailText}>{user?.email}</Text>
          <View style={styles.badgeRow}>
            <Badge variant="emerald">Verified Tutor</Badge>
            <Badge variant={user?.onlineStatus === 'online' ? 'emerald' : 'zinc'}>
              {user?.onlineStatus === 'online' ? 'Online' : 'Offline'}
            </Badge>
          </View>
        </Card>

        {/* Personal Details Form */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionHeading}>Personal Information</Text>

          <View style={styles.formGrid}>
            <FormField
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Sipho"
            />
            <FormField
              label="Surname"
              value={surname}
              onChangeText={setSurname}
              placeholder="e.g. Dlamini"
            />
            <FormField
              label="Email Address"
              value={user?.email || ''}
              editable={false}
              placeholder="Your email"
              helperText="Email cannot be changed"
            />
            <FormField
              label="Cell Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="e.g. 082 123 4567"
              keyboardType="phone-pad"
            />
            <FormField
              label="University / Institution"
              value={university}
              onChangeText={setUniversity}
              placeholder="e.g. University of Cape Town"
            />
            <FormField
              label="Degree / Qualification"
              value={degree}
              onChangeText={setDegree}
              placeholder="e.g. BSc Computer Science"
            />
            <FormField
              label="Biography & Teaching Experience"
              value={biography}
              onChangeText={setBiography}
              placeholder="Tell students about your teaching approach and academic background..."
              multiline
              numberOfLines={4}
            />
          </View>

          <Button
            variant="primary"
            size="lg"
            onPress={handleSave}
            loading={loading}
            style={styles.saveBtn}
          >
            Save Changes
          </Button>
        </Card>

        {/* Account Safety / Danger Zone */}
        <Card style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <Text style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerDesc}>
            Permanently delete your tutor account and remove all personal information and credentials.
          </Text>
          <Button
            variant="danger"
            size="md"
            onPress={handleDeleteAccount}
            style={styles.deleteBtn}
          >
            Delete Account
          </Button>
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successBannerText: {
    fontSize: 13,
    color: colors.brandDark,
    fontWeight: '700',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  avatarCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.brandLight,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.brandDark,
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileNameText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  profileEmailText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  formCard: {
    padding: 18,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  formGrid: {
    gap: 12,
  },
  saveBtn: {
    marginTop: 16,
  },
  dangerCard: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    marginBottom: 20,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  dangerDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
  },
});
