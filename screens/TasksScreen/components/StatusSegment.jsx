/**
 * StatusSegment — the Tasks header's status keys: TO DO · DONE · ALL.
 * Replaces the "Show incomplete only" switch that lived inside the filter
 * sheet: the status of what you are looking at belongs in the header, next
 * to the board you are looking at. Three keys in one hairline box; the
 * active key fills with the text colour (a lit key), the others stay quiet.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tapHaptic } from '../../../utils/haptics';

export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

function StatusSegment({ value, onChange, theme, testID = 'status-segment' }) {
  const c = theme.colors;
  return (
    <View style={[styles.box, { borderColor: c.borderStrong }]} accessibilityRole="tablist" testID={testID}>
      {STATUS_OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPressIn={() => tapHaptic()}
            onPress={() => { if (!on) onChange(o.value); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label} tasks`}
            testID={`${testID}-${o.value}`}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [
              styles.key,
              on && { backgroundColor: c.textPrimary },
              pressed && !on && styles.pressed,
            ]}
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
