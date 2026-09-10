/**
 * ScheduleCard — the day panel's task row: the TIME on the left, a soft
 * tinted card on the right (docs/STYLE-RULES.md §1, "schedule cards").
 *
 * Reads like a planner page: a light column of clock labels, then a card
 * washed in the board's colour (pastel on the light page, a deeper tint on
 * the dark one) carrying the title, the board name, a completion ring and
 * the time range bottom-right. Nothing else — the details live one tap away
 * in the inspector. Untimed rows keep the same shape with a quiet label in
 * the time column so the eye scans one straight edge.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { tapHaptic, impactHaptic } from '../../../utils/haptics';
import { boardLabel } from '../utils/taskHelpers';

/** "08 AM" / "08:30 AM" (or "08:30" in 24 h) for a minutes-since-midnight value. */
export function clockLabel(minutes, use24h = false) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mm = String(m).padStart(2, '0');
  if (use24h) return `${String(h).padStart(2, '0')}:${mm}`;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = String(h % 12 || 12).padStart(2, '0');
  return m ? `${h12}:${mm} ${ap}` : `${h12} ${ap}`;
}

/** A #RRGGBB colour at `alpha` (0–1); anything else falls back to `fallback`. */
export function tintOf(hex, alpha, fallback) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

function ScheduleCard({
  task, timeLabel, range, color, done, theme, onPress, onLongPress, onToggle, owner, onOwnerPress, trailing, subtitle, testID,
}) {
  const c = theme.colors;
  const dark = theme.mode === 'dark';
  const fill = tintOf(color, dark ? 0.26 : 0.18, dark ? c.surfaceElevated : c.surface);
  const title = task?.title || 'Untitled';
  const sub = subtitle !== undefined ? subtitle : (task?.project ? boardLabel(task.project) : '');
  return (
    <View style={styles.row} testID={testID}>
      <Text style={[styles.time, { color: c.textTertiary }]} numberOfLines={1}>{timeLabel}</Text>
      <Pressable
        onPressIn={() => tapHaptic()}
        onPress={() => onPress?.(task)}
        onLongPress={() => onLongPress?.(task)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}${range ? `, ${range}` : ''}${done ? ', done' : ''}`}
        style={({ pressed }) => [styles.card, { backgroundColor: fill }, pressed && styles.pressed, done && styles.done]}
      >
        <View style={styles.top}>
          <Text style={[styles.title, { color: c.textPrimary }, done && styles.struck]} numberOfLines={2}>{title}</Text>
          {onToggle && (
            <TouchableOpacity
              onPressIn={() => impactHaptic('light')}
              onPress={() => onToggle(task)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!done }}
              accessibilityLabel={done ? 'Mark not done' : 'Mark done'}
              style={[styles.ring, { borderColor: c.textPrimary }, done && { backgroundColor: c.textPrimary }]}
            >
              {done && <Icon name="check" size={14} color={c.background} />}
            </TouchableOpacity>
          )}
        </View>
        {!!sub && <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>{sub}</Text>}
        <View style={styles.bottom}>
          {owner ? (
            <TouchableOpacity
              style={[styles.owner, { backgroundColor: owner.color }]}
              onPress={() => onOwnerPress?.(task)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Owner: ${owner.name}. Open profile`}
            >
              <Text style={styles.ownerText}>{(owner.name || '?').trim().charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          ) : <View />}
          <View style={styles.bottomRight}>
            {trailing}
            {!!range && <Text style={[styles.range, { color: c.textTertiary }]} numberOfLines={1}>{range}</Text>}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default memo(ScheduleCard);

export const TIME_COL_W = 62;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  time: {
    width: TIME_COL_W,
    paddingTop: 16,
    paddingRight: 8,
    fontSize: 12,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    minHeight: 72,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  sub: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 3,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  range: {
    fontSize: 12,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  owner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  done: {
    opacity: 0.55,
  },
});
