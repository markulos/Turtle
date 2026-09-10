/**
 * StatusSegment — the Tasks header's status keys: TO DO · DONE · ALL.
 * Replaces the "Show incomplete only" switch that lived inside the filter
 * sheet: the status of what you are looking at belongs in the header, next
 * to the board you are looking at. Three keys in one hairline box; ONE lit
 * pill (the text colour) glides between them on the UI thread — the same
 * segmented-thumb motion as the calendar / list toggle — instead of the
 * fill snapping from key to key.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { tapHaptic } from '../../../utils/haptics';

export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

const SLIDE_MS = 260;
const SLIDE_EASE = Easing.bezier(0.4, 0, 0.2, 1);

function StatusSegment({ value, onChange, theme, testID = 'status-segment' }) {
  const c = theme.colors;
  // Each key reports its frame once laid out; the pill is driven from those.
  const [frames, setFrames] = useState({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const settledRef = useRef(false);
  const frame = frames[value];
  useEffect(() => {
    if (!frame) return;
    if (!settledRef.current) {
      // First layout: place the pill without motion.
      pillX.value = frame.x;
      pillW.value = frame.width;
      settledRef.current = true;
      return;
    }
    pillX.value = withTiming(frame.x, { duration: SLIDE_MS, easing: SLIDE_EASE });
    pillW.value = withTiming(frame.width, { duration: SLIDE_MS, easing: SLIDE_EASE });
  }, [frame, pillX, pillW]);
  const pillStyle = useAnimatedStyle(() => ({
    width: pillW.value,
    transform: [{ translateX: pillX.value }],
    opacity: pillW.value > 0 ? 1 : 0,
  }));

  return (
    <View style={[styles.box, { borderColor: c.borderStrong }]} accessibilityRole="tablist" testID={testID}>
      <Reanimated.View pointerEvents="none" style={[styles.pill, { backgroundColor: c.textPrimary }, pillStyle]} />
      {STATUS_OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setFrames((prev) => (prev[o.value] && prev[o.value].x === x && prev[o.value].width === width ? prev : { ...prev, [o.value]: { x, width } }));
            }}
            onPressIn={() => tapHaptic()}
            onPress={() => { if (!on) onChange(o.value); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label} tasks`}
            testID={`${testID}-${o.value}`}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [styles.key, pressed && !on && styles.pressed]}
          >
            <Text style={[styles.keyText, { color: on ? c.background : c.textTertiary }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(StatusSegment);

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: 7,
  },
  key: {
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.6,
  },
});
