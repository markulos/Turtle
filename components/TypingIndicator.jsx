/**
 * TypingIndicator — "Turtle is typing" as a small live bubble instead of an
 * italic line: the turtle icon bobs gently and three dots pulse in sequence,
 * the way every messenger signals a reply on its way. Sits where the next
 * assistant bubble will land (left-aligned, same radius as messageBubble).
 *
 * All motion is Reanimated on the UI thread (withRepeat / withSequence), so
 * it keeps ticking while the JS thread is busy with the reply itself.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const turtleIcon = require('../assets/turtle-icon.png');

const DOT = 7;
const DOT_MS = 380;
const DOT_STAGGER_MS = 140;
const BOB_MS = 900;

function Dot({ color, delay }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: DOT_MS, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ translateY: -v.value * 3 }, { scale: 0.85 + v.value * 0.25 }],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function TypingIndicator({ theme, testID = 'typing-indicator' }) {
  const c = theme?.colors || {};
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * 2 }, { rotate: `${(bob.value - 0.5) * 8}deg` }],
  }));

  return (
    <View
      style={[styles.bubble, { backgroundColor: c.surfaceElevated || c.surface || '#1c1c1e', borderColor: c.border || 'rgba(127,127,127,0.25)' }]}
      accessibilityLabel="Turtle is typing"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Animated.View style={bobStyle}>
        <Image source={turtleIcon} style={styles.icon} contentFit="contain" />
      </Animated.View>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} color={c.textMuted || c.textSecondary || '#9BA1A6'} delay={i * DOT_STAGGER_MS} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    minHeight: 36,
  },
  icon: {
    width: 20,
    height: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: DOT + 6,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
});
