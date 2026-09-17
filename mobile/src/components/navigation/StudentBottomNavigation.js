import { Platform, SafeAreaView, StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RadialActionMenu } from '../student/RadialActionMenu';

const DESTINATIONS = [
  { key: 'Dashboard', label: 'Home', icon: 'home' },
  { key: 'Requests', label: 'Classes', icon: 'book' },
  null,
  { key: 'Wallet', label: 'Payment', icon: 'card' },
  { key: 'Profile', label: 'Profile', icon: 'person' },
];

export function StudentBottomNavigation({ currentRoute, navigate, onCapture, onUpload, onDescribe }) {
  const selectedRoute = currentRoute === 'Sessions' ? 'Requests' : currentRoute;
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
      <View pointerEvents="box-none" style={styles.dock}>
        <View style={styles.bar}>
          {DESTINATIONS.map((item, index) => item ? (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: selectedRoute === item.key }}
              aria-selected={selectedRoute === item.key}
              onPress={() => navigate(item.key)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={[styles.icon, selectedRoute === item.key && styles.selectedIcon]}>
                <Ionicons name={selectedRoute === item.key ? item.icon : `${item.icon}-outline`} size={23} color={selectedRoute === item.key ? '#047857' : '#71717a'} />
              </View>
            </Pressable>
          ) : <View key={`request-${index}`} pointerEvents="none" style={styles.tab} />)}
        </View>
        <RadialActionMenu docked onCapture={onCapture} onUpload={onUpload} onDescribe={onDescribe} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', zIndex: 1100 },
  dock: {
    height: 200,
    width: '100%',
    maxWidth: 520,
    marginBottom: Platform.OS === 'ios' ? 8 : 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 37,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  tab: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selectedIcon: { backgroundColor: '#ecfdf5' },
  pressed: { opacity: 0.6 },
});
