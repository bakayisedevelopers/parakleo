import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/auth/HomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { DashboardScreen } from '../screens/student/DashboardScreen';
import { OnboardingScreen } from '../screens/student/OnboardingScreen';
import { RequestsScreen } from '../screens/student/RequestsScreen';
import { SessionsScreen } from '../screens/student/SessionsScreen';
import { WalletScreen } from '../screens/student/WalletScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { colors } from '../theme/colors';

const authScreens = {
  Home: HomeScreen,
  Login: LoginScreen,
  Signup: SignupScreen,
};

const studentTabs = [
  { key: 'Dashboard', label: 'Home', component: DashboardScreen },
  { key: 'Onboarding', label: 'Complete Profile', component: OnboardingScreen },
  { key: 'Requests', label: 'Classes', component: RequestsScreen },
  { key: 'Sessions', label: 'Classes', component: SessionsScreen },
  { key: 'Wallet', label: 'Payment', component: WalletScreen },
  { key: 'Profile', label: 'Profile', component: ProfileScreen },
];

export function RootNavigator() {
  const { initializing, logout, user } = useAuth();
  const [authRoute, setAuthRoute] = useState('Home');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isNavOpen, setIsNavOpen] = useState(false);

  if (initializing) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState label="Restoring session" />
      </SafeAreaView>
    );
  }

  if (!user) {
    const AuthScreen = authScreens[authRoute];
    return (
      <SafeAreaView style={styles.safe}>
        <AuthScreen navigate={setAuthRoute} />
      </SafeAreaView>
    );
  }

  const active = studentTabs.find((tab) => tab.key === activeTab) || studentTabs[0];
  const ActiveScreen = active.component;
  const openRoute = (route) => {
    setActiveTab(route);
    setIsNavOpen(false);
  };
  const handleLogout = async () => {
    setAuthRoute('Home');
    setIsNavOpen(false);
    await logout();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => setIsNavOpen(true)} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <View style={styles.topbarSpacer} />
          <View style={styles.topbarActions}>
            <Pressable accessibilityRole="button" style={styles.iconButton}>
              <Text style={styles.iconText}>↗</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.iconButton}>
              <Text style={styles.iconText}>•</Text>
              <View style={styles.notificationDot} />
            </Pressable>
            <View style={styles.identityPill}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>U</Text>
              </View>
              <Text style={styles.identityName} numberOfLines={1}>{user?.fullName || user?.displayName || 'Claxi User'}</Text>
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <ActiveScreen navigate={setActiveTab} />
        </ScrollView>
        <Modal animationType="fade" transparent visible={isNavOpen} onRequestClose={() => setIsNavOpen(false)}>
          <View style={styles.overlay}>
            <Pressable accessibilityRole="button" onPress={() => setIsNavOpen(false)} style={styles.scrim} />
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>C</Text>
                </View>
                <View style={styles.sidebarTitleWrap}>
                  <Text style={styles.sidebarTitle}>Claxi</Text>
                  <Text style={styles.sidebarSubtitle}>student workspace</Text>
                </View>
              </View>
              <View style={styles.navList}>
                {studentTabs
                  .filter((tab) => ['Dashboard', 'Requests', 'Wallet'].includes(tab.key))
                  .map((tab) => (
                    <Pressable
                      accessibilityRole="button"
                      key={tab.key}
                      onPress={() => openRoute(tab.key)}
                      style={[styles.navItem, active.key === tab.key && styles.navItemActive]}
                    >
                      <Text style={[styles.navText, active.key === tab.key && styles.navTextActive]}>{tab.label}</Text>
                    </Pressable>
                  ))}
              </View>
              <View style={styles.sidebarFooter}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openRoute('Onboarding')}
                  style={[styles.navItem, active.key === 'Onboarding' && styles.navItemDark]}
                >
                  <Text style={[styles.navText, active.key === 'Onboarding' && styles.navTextDark]}>Complete Profile</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openRoute('Profile')}
                  style={[styles.navItem, active.key === 'Profile' && styles.navItemDark]}
                >
                  <Text style={[styles.navText, active.key === 'Profile' && styles.navTextDark]}>Profile</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.navItem}>
                  <Text style={styles.navText}>Log out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
  },
  topbar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 12,
    padding: 12,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  menuIcon: {
    color: '#3f3f46',
    fontSize: 22,
    fontWeight: '900',
  },
  topbarSpacer: {
    flex: 1,
  },
  topbarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '80%',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
  },
  iconText: {
    color: '#3f3f46',
    fontSize: 18,
    fontWeight: '900',
  },
  notificationDot: {
    backgroundColor: '#f43f5e',
    borderRadius: 5,
    height: 8,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 8,
  },
  identityPill: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  identityName: {
    color: '#3f3f46',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingTop: 4,
  },
  overlay: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  sidebar: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    bottom: 12,
    left: 12,
    padding: 16,
    position: 'absolute',
    top: 12,
    width: '85%',
  },
  sidebarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  sidebarTitleWrap: {
    flex: 1,
  },
  sidebarTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sidebarSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  navList: {
    gap: 6,
  },
  navItem: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navItemActive: {
    backgroundColor: colors.brand,
  },
  navItemDark: {
    backgroundColor: colors.text,
  },
  navText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  navTextActive: {
    color: '#ffffff',
  },
  navTextDark: {
    color: '#ffffff',
  },
  sidebarFooter: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 6,
    marginTop: 'auto',
    paddingTop: 16,
  },
});
