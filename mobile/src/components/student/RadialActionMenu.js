import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACTION_OPTIONS = [
  { id: 'capture', label: 'Capture Picture', icon: 'camera', x: -68, y: -68 },
  { id: 'upload', label: 'Upload Document', icon: 'cloud-upload', x: 0, y: -84 },
  { id: 'describe', label: 'Describe Problem', icon: 'create-outline', x: 68, y: -68 },
];

export function RadialActionMenu({ onCapture, onUpload, onDescribe, docked = false, onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  function updateOpen(nextOpen) {
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      updateOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [isOpen]);

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: isOpen ? 1 : 0,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isOpen, animValue]);

  function handleToggle() {
    updateOpen(!isOpen);
  }

  function handleSelect(actionId) {
    updateOpen(false);
    if (actionId === 'capture') onCapture?.();
    else if (actionId === 'upload') onUpload?.();
    else if (actionId === 'describe') onDescribe?.();
  }

  const spin = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View pointerEvents="box-none" style={[styles.container, docked && (isOpen ? styles.dockedContainer : styles.dockedClosedContainer)]}>
      {/* Standalone animated orbital action buttons (No overlay / No modal) */}
      {isOpen ? (
        <View pointerEvents="box-none" style={styles.optionsLayer}>
          {ACTION_OPTIONS.map((action) => {
            const translateX = animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, action.x],
            });
            const translateY = animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, action.y],
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
                key={action.id}
                style={[
                  styles.radialItemWrap,
                  docked && styles.dockedItemWrap,
                  {
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              >
                <Pressable
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  onPress={() => handleSelect(action.id)}
                  style={styles.radialButton}
                >
                  <Ionicons name={action.icon} size={22} color="#059669" />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      ) : null}

      {/* Main Trigger / Close Button with Halo Ring - stays in exact same position, changes state */}
      <View pointerEvents="box-none" style={styles.triggerWrapper}>
        <View style={[styles.haloRing, isOpen && styles.haloRingActive]} />
        <Pressable
          accessibilityLabel={isOpen ? 'Close learning actions' : docked ? 'Request a tutor' : 'Start learning action'}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          aria-expanded={isOpen}
          onPress={handleToggle}
          style={[styles.mainButton, isOpen && styles.mainButtonOpen]}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons
              name={isOpen ? 'close' : docked ? 'add' : 'arrow-forward'}
              size={24}
              color="#ffffff"
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockedContainer: {
    height: 190,
    width: 220,
    marginTop: 0,
    justifyContent: 'flex-end',
  },
  dockedClosedContainer: {
    height: 74,
    width: 74,
    marginTop: 0,
    justifyContent: 'flex-end',
  },
  dockedItemWrap: {
    left: 86,
    bottom: 13,
    width: 48,
    height: 48,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    overflow: 'visible',
    position: 'relative',
    zIndex: 900,
  },
  optionsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 899,
  },
  radialItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  radialButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#bbf7d0',
    borderRadius: 24,
    borderWidth: 1.5,
    elevation: 6,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    width: 48,
  },
  triggerWrapper: {
    alignItems: 'center',
    height: 74,
    justifyContent: 'center',
    position: 'relative',
    width: 74,
    zIndex: 901,
  },
  haloRing: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#a7f3d0',
    borderRadius: 37,
    borderWidth: 2,
    height: 74,
    position: 'absolute',
    width: 74,
  },
  haloRingActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.22)',
    borderColor: '#059669',
  },
  mainButton: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 28,
    elevation: 8,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: 56,
  },
  mainButtonOpen: {
    backgroundColor: '#047857',
  },
});
