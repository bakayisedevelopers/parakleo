import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ALL_DESTINATIONS = [
  { key: 'Dashboard', label: 'Home', icon: 'home' },
  { key: 'Wallet', label: 'Payment', icon: 'card' },
  { key: 'Requests', label: 'Classes', icon: 'book' },
  { key: 'Notifications', label: 'Alerts', icon: 'notifications' },
  { key: 'Profile', label: 'Profile', icon: 'person' },
];

export function RadialNavMenu({
  currentRoute = 'Dashboard',
  navigate,
  unreadCount = 0,
  triggerStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  // Filter out the current active screen so exactly 4 options are shown
  const activeDestinations = useMemo(() => {
    const normalized = String(currentRoute || 'Dashboard').toLowerCase();
    return ALL_DESTINATIONS.filter((dest) => {
      const destKey = dest.key.toLowerCase();
      if (normalized === 'requests' || normalized === 'requeststatus' || normalized === 'requestdetails') {
        return destKey !== 'requests';
      }
      if (normalized === 'wallet') {
        return destKey !== 'wallet';
      }
      if (normalized === 'profile') {
        return destKey !== 'profile';
      }
      if (normalized === 'notifications') {
        return destKey !== 'notifications';
      }
      return destKey !== 'dashboard';
    }).slice(0, 4);
  }, [currentRoute]);

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: isOpen ? 1 : 0,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isOpen, animValue]);

  function handleToggle() {
    setIsOpen((curr) => !curr);
  }

  function handleSelect(destKey) {
    setIsOpen(false);
    if (navigate) {
      navigate(destKey);
    }
  }

  // Pre-calculated radial offsets for 4 items evenly spaced in an arc (30° apart, radius 64px)
  const orbitalOffsets = [
    { x: -64, y: 0 },
    { x: -55, y: 32 },
    { x: -32, y: 55 },
    { x: 0, y: 64 },
  ];

  const spin = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.container}>
      {/* Standalone animated orbital buttons (No circle backgrounds, evenly spaced) */}
      {isOpen ? (
        <View style={styles.optionsLayer}>
          {activeDestinations.map((item, index) => {
            const offset = orbitalOffsets[index] || { x: -50, y: 35 };
            const translateX = animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, offset.x],
            });
            const translateY = animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, offset.y],
            });
            const scale = animValue.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.5, 1],
            });
            const opacity = animValue.interpolate({
              inputRange: [0, 0.25, 1],
              outputRange: [0, 0.4, 1],
            });

            return (
              <Animated.View
                key={item.key}
                style={[
                  styles.radialItemWrap,
                  {
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              >
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  onPress={() => handleSelect(item.key)}
                  style={styles.radialButton}
                >
                  <Ionicons name={item.icon} size={24} color="#059669" />
                  {item.key === 'Notifications' && unreadCount > 0 ? (
                    <View style={styles.unreadDot} />
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      ) : null}

      {/* Main Trigger / Close Button - stays in exact same position, changes state */}
      <Pressable
        accessibilityLabel={isOpen ? 'Close navigation menu' : 'Navigation menu'}
        accessibilityRole="button"
        onPress={handleToggle}
        style={[
          styles.triggerButton,
          isOpen && styles.triggerButtonOpen,
          triggerStyle,
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons
            name={isOpen ? 'close' : 'menu'}
            size={22}
            color={isOpen ? '#ffffff' : '#059669'}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
    zIndex: 1000,
  },
  optionsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  radialItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  radialButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    position: 'relative',
    width: 38,
  },
  unreadDot: {
    backgroundColor: '#ef4444',
    borderColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1.5,
    height: 8,
    position: 'absolute',
    right: 4,
    top: 4,
    width: 8,
  },
  triggerButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderRadius: 22,
    borderWidth: 1.5,
    elevation: 4,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 44,
    zIndex: 1001,
  },
  triggerButtonOpen: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
});
