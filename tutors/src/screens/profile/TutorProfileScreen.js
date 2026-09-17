import { useMemo } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { isTutorAgreementCurrent } from '../../constants/onboarding';
import { colors } from '../../theme/colors';

export function TutorProfileScreen({ navigate, goBack }) {
  const { user, logout } = useAuth();

  const tutorProfile = user?.tutorProfile || {};
  const photoUri = user?.selfieUrl || user?.profilePhoto || user?.photoURL || '';
  const isOnline = user?.onlineStatus === 'online';
  const isAgreementSigned = isTutorAgreementCurrent(user);

  const tutorName = user?.fullName || user?.displayName || 'Tutor';
  const teachingSubjectsCount = (tutorProfile?.teachingSubjects || user?.activeSubjects || []).length;
  const rating = Number(tutorProfile?.overallRating ?? user?.overallRating ?? 5.0).toFixed(1);

  const getInitials = () => {
    const parts = String(tutorName).trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return tutorName.charAt(0).toUpperCase() || 'T';
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Parakleo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Settings & Profile"
        subtitle="Manage account, qualifications, and legal terms"
        onBack={() => {
          if (goBack) goBack();
          else if (navigate) navigate('Dashboard');
        }}
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
        {/* AVATAR & TUTOR STATUS HERO CARD */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{getInitials()}</Text>
              </View>
            )}
            <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
          </View>

          <Text style={styles.nameText}>{tutorName}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            <Badge variant="emerald">Verified Tutor</Badge>
            <Badge variant={isOnline ? 'emerald' : 'zinc'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </View>
        </Card>

        {/* NAVIGATION SETTINGS MENU */}
        <Text style={styles.menuSectionHeader}>Preferences & Management</Text>
        <Card style={styles.navMenuCard}>
          {/* Account & Personal Details */}
          <Pressable
            onPress={() => navigate('TutorAccount')}
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
          >
            <View style={styles.navIconCircle}>
              <Ionicons name="person-outline" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>Account & Personal Details</Text>
              <Text style={styles.navItemSubtitle}>Name, phone, university & bio</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          {/* Subjects & Qualifications */}
          <Pressable
            onPress={() => navigate('TutorQualifications')}
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
          >
            <View style={styles.navIconCircle}>
              <Ionicons name="school-outline" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>Subjects & Qualifications</Text>
              <Text style={styles.navItemSubtitle}>
                {teachingSubjectsCount > 0
                  ? `${teachingSubjectsCount} active subject${teachingSubjectsCount === 1 ? '' : 's'}`
                  : 'Manage eligible subjects'}
              </Text>
            </View>
            {teachingSubjectsCount > 0 ? (
              <Badge variant="sky" style={{ marginRight: 6 }}>
                {teachingSubjectsCount}
              </Badge>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          {/* Legal & Agreements */}
          <Pressable
            onPress={() => navigate('TutorLegal')}
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
          >
            <View style={styles.navIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>Legal & Agreements</Text>
              <Text style={styles.navItemSubtitle}>Tutor agreement & platform policies</Text>
            </View>
            <Badge variant={isAgreementSigned ? 'emerald' : 'amber'} style={{ marginRight: 6 }}>
              {isAgreementSigned ? 'Signed' : 'Action Required'}
            </Badge>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          {/* Tutor Stats & Performance */}
          <Pressable
            onPress={() => navigate('TutorMetrics')}
            style={({ pressed }) => [styles.navItem, styles.navItemLast, pressed && styles.navItemPressed]}
          >
            <View style={styles.navIconCircle}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.brandDark} />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>Tutor Stats & Ratings</Text>
              <Text style={styles.navItemSubtitle}>Acceptance, completion & ratings</Text>
            </View>
            <Text style={styles.ratingBadgeText}>★ {rating}</Text>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        </Card>

        {/* LOGOUT BUTTON */}
        <View style={styles.logoutContainer}>
          <Button
            variant="secondary"
            size="lg"
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110, // Padding for bottom floating bar
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
    backgroundColor: '#ffffff',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.brandLight,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.brandDark,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#94a3b8',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  emailText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  menuSectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  navMenuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#ffffff',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navItemLast: {
    borderBottomWidth: 0,
  },
  navItemPressed: {
    backgroundColor: '#f8fafc',
  },
  navIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navItemContent: {
    flex: 1,
  },
  navItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  navItemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#d97706',
    marginRight: 6,
  },
  logoutContainer: {
    marginBottom: 16,
  },
  logoutButton: {
    width: '100%',
  },
});
