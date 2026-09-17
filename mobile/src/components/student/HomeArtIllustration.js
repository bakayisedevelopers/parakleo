import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function HomeArtIllustration() {
  return (
    <View style={styles.container}>
      {/* Ground/Grass Patch */}
      <View style={styles.groundPatch} />

      {/* --- Floral Stems Behind Books --- */}
      {/* Tall central stem */}
      <View style={[styles.stem, { height: 210, left: '50%', top: 20 }]} />
      {/* Left stem */}
      <View style={[styles.stem, { height: 180, left: '26%', top: 50, transform: [{ rotate: '-12deg' }] }]} />
      {/* Far left stem */}
      <View style={[styles.stem, { height: 150, left: '16%', top: 80, transform: [{ rotate: '-20deg' }] }]} />
      {/* Right stem */}
      <View style={[styles.stem, { height: 190, left: '72%', top: 40, transform: [{ rotate: '14deg' }] }]} />
      {/* Far right stem */}
      <View style={[styles.stem, { height: 140, left: '84%', top: 90, transform: [{ rotate: '22deg' }] }]} />

      {/* Leaves on stems */}
      <View style={[styles.leaf, { left: '20%', top: 110, transform: [{ rotate: '-45deg' }] }]} />
      <View style={[styles.leaf, { left: '30%', top: 75, transform: [{ rotate: '35deg' }] }]} />
      <View style={[styles.leaf, { left: '46%', top: 45, transform: [{ rotate: '-40deg' }] }]} />
      <View style={[styles.leaf, { left: '54%', top: 60, transform: [{ rotate: '40deg' }] }]} />
      <View style={[styles.leaf, { left: '68%', top: 95, transform: [{ rotate: '-30deg' }] }]} />
      <View style={[styles.leaf, { left: '78%', top: 120, transform: [{ rotate: '45deg' }] }]} />

      {/* --- Flowers --- */}
      {/* Top Left Coral/Pink Poppy */}
      <View style={[styles.flowerPoppy, { left: '12%', top: 60 }]}>
        <View style={[styles.poppyPetal, styles.poppyPetal1]} />
        <View style={[styles.poppyPetal, styles.poppyPetal2]} />
        <View style={[styles.poppyPetal, styles.poppyPetal3]} />
        <View style={styles.flowerCenterYellow} />
      </View>

      {/* Top Center-Left Marigold / Yellow Blossom */}
      <View style={[styles.flowerMarigold, { left: '38%', top: 18 }]}>
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '135deg' }] }]} />
        <View style={styles.marigoldCenter} />
      </View>

      {/* Center Yellow Marigold Blossom */}
      <View style={[styles.flowerMarigold, { left: '32%', top: 88 }]}>
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.marigoldPetal, { transform: [{ rotate: '135deg' }] }]} />
        <View style={styles.marigoldCenter} />
      </View>

      {/* Center-Right Pink Daisy */}
      <View style={[styles.flowerDaisy, { left: '60%', top: 65 }]}>
        <View style={[styles.daisyPetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.daisyPetal, { transform: [{ rotate: '30deg' }] }]} />
        <View style={[styles.daisyPetal, { transform: [{ rotate: '60deg' }] }]} />
        <View style={[styles.daisyPetal, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.daisyPetal, { transform: [{ rotate: '120deg' }] }]} />
        <View style={[styles.daisyPetal, { transform: [{ rotate: '150deg' }] }]} />
        <View style={styles.flowerCenterYellow} />
      </View>

      {/* Right Orange Blossom */}
      <View style={[styles.orangeBlossom, { left: '68%', top: 130 }]}>
        <View style={styles.orangeBlossomPetal} />
        <View style={[styles.orangeBlossomPetal, { transform: [{ rotate: '60deg' }] }]} />
        <View style={[styles.orangeBlossomPetal, { transform: [{ rotate: '120deg' }] }]} />
      </View>

      {/* Small White Chamomile Flowers */}
      <View style={[styles.chamomile, { left: '13%', top: 125 }]}>
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '135deg' }] }]} />
        <View style={styles.chamomileCenter} />
      </View>
      <View style={[styles.chamomile, { left: '76%', top: 175 }]}>
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.chamomilePetal, { transform: [{ rotate: '135deg' }] }]} />
        <View style={styles.chamomileCenter} />
      </View>

      {/* Lower Left Wildflower Bud */}
      <View style={[styles.flowerBud, { left: '10%', top: 200 }]} />
      {/* Lower Right Wildflower Bud */}
      <View style={[styles.flowerBud, { left: '77%', top: 215 }]} />

      {/* --- The Four Standing Books --- */}
      <View style={styles.booksRow}>
        {/* Book 1: Denim Blue */}
        <View style={[styles.bookContainer, { height: 140, width: 34 }]}>
          {/* 3D Top Pages */}
          <View style={[styles.bookTop, { width: 34, backgroundColor: '#eaebdf' }]}>
            <View style={styles.bookTopCoverBorder} />
          </View>
          {/* Spine */}
          <View style={[styles.bookSpine, { backgroundColor: '#385573' }]}>
            <View style={styles.spineHighlight} />
            <View style={[styles.spineStripe, { top: 22 }]} />
            <View style={[styles.spineStripe, { top: 26 }]} />
            <View style={[styles.spineStripe, { bottom: 22 }]} />
            <View style={[styles.spineStripe, { bottom: 26 }]} />
          </View>
        </View>

        {/* Book 2: Coral Pink */}
        <View style={[styles.bookContainer, { height: 148, width: 32 }]}>
          <View style={[styles.bookTop, { width: 32, backgroundColor: '#f2e8dc' }]} />
          <View style={[styles.bookSpine, { backgroundColor: '#f0949d' }]}>
            <View style={styles.spineHighlight} />
            <View style={[styles.spineSubtleLine, { top: 16 }]} />
            <View style={[styles.spineSubtleLine, { bottom: 16 }]} />
          </View>
        </View>

        {/* Book 3: Terracotta Orange */}
        <View style={[styles.bookContainer, { height: 154, width: 38 }]}>
          <View style={[styles.bookTop, { width: 38, backgroundColor: '#f3e6d6' }]} />
          <View style={[styles.bookSpine, { backgroundColor: '#e27344' }]}>
            <View style={styles.spineHighlight} />
            <View style={[styles.spineRib, { top: 30 }]} />
            <View style={[styles.spineRib, { top: 34 }]} />
            <View style={[styles.spineRib, { bottom: 30 }]} />
            <View style={[styles.spineRib, { bottom: 34 }]} />
          </View>
        </View>

        {/* Book 4: Mint Turquoise with "BDI CULTO" */}
        <View style={[styles.bookContainer, { height: 142, width: 44 }]}>
          <View style={[styles.bookTop, { width: 44, backgroundColor: '#e6ede6' }]} />
          <View style={[styles.bookSpine, { backgroundColor: '#76b1b0' }]}>
            <View style={styles.spineHighlight} />
            {/* White Label Emblem */}
            <View style={styles.bookEmblem}>
              <Text style={styles.emblemTextTop}>BDI</Text>
              <Text style={styles.emblemTextBottom}>CULTO</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: 330,
    justifyContent: 'flex-end',
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  groundPatch: {
    backgroundColor: '#d1fae5',
    borderRadius: 80,
    bottom: 0,
    height: 24,
    opacity: 0.85,
    position: 'absolute',
    width: 240,
  },
  stem: {
    backgroundColor: '#4a7657',
    borderRadius: 2,
    position: 'absolute',
    width: 2.5,
  },
  leaf: {
    backgroundColor: '#4a7657',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 0,
    height: 9,
    position: 'absolute',
    width: 16,
  },
  flowerPoppy: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    width: 38,
  },
  poppyPetal: {
    backgroundColor: '#f28b97',
    borderRadius: 14,
    height: 24,
    position: 'absolute',
    width: 24,
  },
  poppyPetal1: {
    left: 2,
    top: 2,
  },
  poppyPetal2: {
    right: 2,
    top: 4,
  },
  poppyPetal3: {
    bottom: 2,
    left: 7,
  },
  flowerMarigold: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    width: 34,
  },
  marigoldPetal: {
    backgroundColor: '#f5b53d',
    borderRadius: 8,
    height: 12,
    position: 'absolute',
    width: 32,
  },
  marigoldCenter: {
    backgroundColor: '#d97706',
    borderRadius: 6,
    height: 12,
    width: 12,
    zIndex: 2,
  },
  flowerDaisy: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    width: 36,
  },
  daisyPetal: {
    backgroundColor: '#f07c87',
    borderRadius: 7,
    height: 8,
    position: 'absolute',
    width: 34,
  },
  flowerCenterYellow: {
    backgroundColor: '#fbbf24',
    borderRadius: 6,
    height: 12,
    width: 12,
    zIndex: 2,
  },
  orangeBlossom: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    width: 22,
  },
  orangeBlossomPetal: {
    backgroundColor: '#ea6e3e',
    borderRadius: 6,
    height: 8,
    position: 'absolute',
    width: 20,
  },
  chamomile: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    width: 18,
  },
  chamomilePetal: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    height: 5,
    position: 'absolute',
    width: 18,
  },
  chamomileCenter: {
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    height: 6,
    width: 6,
    zIndex: 2,
  },
  flowerBud: {
    backgroundColor: '#ea6e3e',
    borderRadius: 5,
    height: 10,
    position: 'absolute',
    width: 10,
  },
  booksRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    marginBottom: 6,
    zIndex: 10,
  },
  bookContainer: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  bookTop: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    height: 7,
  },
  bookTopCoverBorder: {
    borderBottomWidth: 1,
    borderColor: '#c9d3cb',
    height: 2,
  },
  bookSpine: {
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  spineHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    height: '100%',
    left: 2,
    position: 'absolute',
    width: 3,
  },
  spineStripe: {
    backgroundColor: '#ffffff',
    height: 1.5,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  spineSubtleLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    height: 1,
    left: 4,
    position: 'absolute',
    right: 4,
  },
  spineRib: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    height: 1.5,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  bookEmblem: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#5b9897',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 36,
    paddingHorizontal: 3,
    paddingVertical: 4,
    width: 26,
  },
  emblemTextTop: {
    color: '#346b6a',
    fontSize: 6.5,
    fontWeight: '900',
    lineHeight: 8,
  },
  emblemTextBottom: {
    color: '#346b6a',
    fontSize: 5.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 7,
  },
});
