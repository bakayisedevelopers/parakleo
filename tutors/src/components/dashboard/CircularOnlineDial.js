import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const DIAL_DIAMETER = 210;
const RING_DIAMETER = 226;
const HALO_DIAMETER = 258;
const RADIUS = RING_DIAMETER / 2;
const BORDER_WIDTH = 5;

export function CircularOnlineDial({
  isOnline,
  toggling,
  disabled,
  onToggle,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isPressing = useRef(false);
  const [holdingProgress, setHoldingProgress] = useState(0);

  // Track progress value for UI display
  progress.addListener(({ value }) => {
    setHoldingProgress(Math.round(value * 100));
  });

  const handlePressIn = () => {
    if (disabled || toggling) return;
    isPressing.current = true;

    // Small tactile scale down
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();

    // 1600ms hold duration to complete full 360 circle
    Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && isPressing.current) {
        if (Platform.OS !== 'web') {
          try {
            Vibration.vibrate(80);
          } catch (_) {}
        }
        onToggle(!isOnline);

        // Completion flash bounce
        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.04, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();

        // Reset progress after success
        progress.setValue(0);
        setHoldingProgress(0);
      }
    });
  };

  const handlePressOut = () => {
    isPressing.current = false;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

    // Revert progress smoothly back to 0 if released early
    Animated.timing(progress, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  // Interpolations for 360 degree circular progress
  const rightRotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg'],
    extrapolate: 'clamp',
  });

  const leftRotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '0deg', '180deg'],
    extrapolate: 'clamp',
  });

  const leftOpacity = progress.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const isHolding = holdingProgress > 0 && holdingProgress < 100;

  return (
    <View style={styles.outerContainer}>
      {/* Outermost ambient halo ring (matching middle screenshot outer concentric circle) */}
      <View
        style={[
          styles.ambientHalo,
          isOnline ? styles.ambientHaloOnline : styles.ambientHaloOffline,
        ]}
      >
        {/* Intermediate soft concentric frame */}
        <View
          style={[
            styles.intermediateRing,
            isOnline ? styles.intermediateRingOnline : styles.intermediateRingOffline,
          ]}
        >
          {/* Animated 360 Circular Progress Track */}
          <View style={styles.progressRingWrapper}>
            {/* Background inactive ring */}
            <View
              style={[
                styles.progressRingBackground,
                isOnline
                  ? { borderColor: 'rgba(255, 255, 255, 0.25)' }
                  : { borderColor: 'rgba(16, 185, 129, 0.15)' },
              ]}
            />

            {/* Right half mask */}
            <View style={styles.halfMaskRight}>
              <Animated.View
                style={[
                  styles.progressSemiCircle,
                  {
                    left: -RADIUS,
                    borderColor: isOnline ? '#34d399' : colors.brand,
                    transform: [{ rotate: rightRotate }],
                  },
                ]}
              />
            </View>

            {/* Left half mask */}
            <Animated.View style={[styles.halfMaskLeft, { opacity: leftOpacity }]}>
              <Animated.View
                style={[
                  styles.progressSemiCircle,
                  {
                    left: 0,
                    borderColor: isOnline ? '#34d399' : colors.brand,
                    transform: [{ rotate: leftRotate }],
                  },
                ]}
              />
            </Animated.View>
          </View>

          {/* Interactive Dial Disc */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={disabled || toggling}
              style={[
                styles.dialDisc,
                isOnline ? styles.dialDiscOnline : styles.dialDiscOffline,
              ]}
            >
              {/* TOP SECTION: HOLD / TO */}
              <View style={styles.topSection}>
                <View style={styles.statusIconRow}>
                  <Ionicons
                    name={isOnline ? 'radio' : 'cloud-outline'}
                    size={18}
                    color={isOnline ? '#ffffff' : colors.brand}
                  />
                  <Text
                    style={[
                      styles.holdText,
                      isOnline ? styles.textLight : styles.textDark,
                    ]}
                  >
                    HOLD
                  </Text>
                </View>
                <Text
                  style={[
                    styles.toText,
                    isOnline ? styles.textLightSubtle : styles.textDarkSubtle,
                  ]}
                >
                  TO
                </Text>
              </View>

              {/* SEPARATOR LINE (matching screenshot divider) */}
              <View
                style={[
                  styles.dividerLine,
                  isOnline ? styles.dividerLineOnline : styles.dividerLineOffline,
                ]}
              />

              {/* BOTTOM SECTION: GO ONLINE / GO OFFLINE */}
              <View style={styles.bottomSection}>
                <Text
                  style={[
                    styles.actionText,
                    isOnline ? styles.textLight : styles.actionTextOffline,
                  ]}
                >
                  {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
                </Text>
                <View style={styles.statusIndicatorRow}>
                  <View
                    style={[
                      styles.indicatorDot,
                      isOnline ? styles.indicatorDotOnline : styles.indicatorDotOffline,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusSubtext,
                      isOnline ? styles.textLightSubtle : styles.textDarkSubtle,
                    ]}
                  >
                    {toggling
                      ? 'Updating...'
                      : isHolding
                      ? `${holdingProgress}%`
                      : isOnline
                      ? 'Live & Receiving'
                      : 'Offline'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* Helper text below circle */}
      <Text style={styles.instructionText}>
        {isHolding
          ? 'Keep holding to complete...'
          : isOnline
          ? 'Hold to switch offline'
          : 'Hold to go online & receive requests'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  ambientHalo: {
    width: HALO_DIAMETER,
    height: HALO_DIAMETER,
    borderRadius: HALO_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  ambientHaloOffline: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    borderColor: 'rgba(16, 185, 129, 0.12)',
  },
  ambientHaloOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.09)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  intermediateRing: {
    width: RING_DIAMETER + 14,
    height: RING_DIAMETER + 14,
    borderRadius: (RING_DIAMETER + 14) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  intermediateRingOffline: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(16, 185, 129, 0.18)',
  },
  intermediateRingOnline: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  progressRingWrapper: {
    position: 'absolute',
    width: RING_DIAMETER,
    height: RING_DIAMETER,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingBackground: {
    position: 'absolute',
    width: RING_DIAMETER,
    height: RING_DIAMETER,
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
  },
  halfMaskRight: {
    position: 'absolute',
    top: 0,
    left: RADIUS,
    width: RADIUS,
    height: RING_DIAMETER,
    overflow: 'hidden',
  },
  halfMaskLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RADIUS,
    height: RING_DIAMETER,
    overflow: 'hidden',
  },
  progressSemiCircle: {
    position: 'absolute',
    top: 0,
    width: RING_DIAMETER,
    height: RING_DIAMETER,
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
  },
  dialDisc: {
    width: DIAL_DIAMETER,
    height: DIAL_DIAMETER,
    borderRadius: DIAL_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  dialDiscOffline: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dialDiscOnline: {
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  holdText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  toText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  dividerLine: {
    width: 86,
    height: 2,
    borderRadius: 2,
    marginVertical: 10,
  },
  dividerLineOffline: {
    backgroundColor: '#e2e8f0',
  },
  dividerLineOnline: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bottomSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  actionTextOffline: {
    color: colors.brandDark,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  indicatorDotOffline: {
    backgroundColor: colors.textSubtle,
  },
  indicatorDotOnline: {
    backgroundColor: '#ffffff',
  },
  statusSubtext: {
    fontSize: 11,
    fontWeight: '600',
  },
  textLight: {
    color: '#ffffff',
  },
  textLightSubtle: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  textDark: {
    color: '#18181b',
  },
  textDarkSubtle: {
    color: '#71717a',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
});
