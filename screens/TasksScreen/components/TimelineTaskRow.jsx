import React from 'react';
import { View, Text, TouchableOpacity, PixelRatio } from 'react-native';
import { TAP_ONLY } from '../../../utils/pressBehavior';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../context/ThemeContext';
import { itemTypeOf, formatDueDate } from '../utils/taskHelpers';
import { tapHaptic } from '../../../utils/haptics';
import TaskCountdownBadge from './TaskCountdownBadge';
import { HatchBackdrop } from './HatchBackdrop';
import { insetCardPalette } from '../utils/cardPalette';
import { clockLabel } from './ScheduleCard';

// ── Quick time helpers (self-contained so this row works in any list) ──────────
// Format "HH:MM" honoring the user's 12/24h preference.
const fmtTime = (hhmm, use24h) => {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hs, ms] = hhmm.split(':');
  let h = Number(hs);
  const m = Number(ms);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  if (use24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Add `mins` to "HH:MM" → "HH:MM", clamped to the same day.
const addMinutes = (hhmm, mins) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  let total = h * 60 + m + (Number(mins) || 0);
  total = Math.min(total, 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// Diameter of the activity icon on the rail + where its centre sits, so the
// connecting line segments line up with it exactly.
const ICON = 40;
const ICON_CENTRE = ICON / 2;
const ROW_GAP = 12; // vertical gap below each row; the rail bridges it
const DOT = 22; // diameter of the completion ring overlaid on the card's right edge
// The time column on the left of every row (the planner's "08 AM"), sized
// like ScheduleCard's so the agenda and the day panel share one left edge.
const TIME_COL = 62;
const parseHM = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// Locked card height for `uniform` rows (see below): paddingVertical 9×2 +
// when-line ~18 + one-line title ~20 + subtitle ~18 = 74 at fontScale 1. The
// agenda's PAST zone relies on every row being EXACTLY this + ROW_GAP tall, so
// its lazy-load placeholders occupy identical space and swaps never move the
// layout. Scaled by the device's accessibility font scale (constant for the
// app's lifetime) so large-text users don't get sheared cards — the zone's
// arithmetic stays exact because every consumer shares these constants.
const FONT_SCALE = Math.max(1, PixelRatio.getFontScale());
export const UNIFORM_CARD_H = Math.round(74 * FONT_SCALE);
export const UNIFORM_ROW_H = UNIFORM_CARD_H + ROW_GAP;

// A single task/event rendered as a timeline entry: an activity icon on a
// connecting rail, then a card with the date + time range, a live countdown
// badge (minute precision) to when it happens, the title, and a grey subtitle.
// Keeps every existing action — tap → inspector, long-press → full edit, tap
// the toggle → complete.
// `uniform`: locks the card to UNIFORM_CARD_H with a ONE-line title, making
// the whole row a fixed UNIFORM_ROW_H — required by the agenda's past zone,
// where skeleton placeholders must match real rows to the pixel.
export const TimelineTaskRow = ({ item, onPress, onLongPress, onToggleComplete, isFirst, isLast, hideDate, done, doneDate, hideCountdown, railColor, cardColor, uniform, whenLabelFallback = 'No date', trailing, hatchColor, owner, onOwnerPress }) => {
  const { theme, timeFormat } = useTheme();
  const c = theme.colors || {};
  const use24h = timeFormat === '24h';

  // The card is INVERTED against the screen (black on light, white on dark —
  // utils/cardPalette). `cardColor` is accepted for compatibility but the
  // inverted fill wins: a tone override would put the card back into the page.
  const inv = insetCardPalette(theme);
  const cText = inv.text;
  const cSub = inv.sub;
  const cMuted = inv.muted;
  const cCardBg = inv.card;
  const cBorder = inv.edge;
  void cardColor;
  // The connecting rail can be emphasised by the caller (the agenda draws it as
  // the strong black/white line); defaults to the faint border tint.
  void railColor; // the rail is gone: the row's left edge is the time column

  // The completion ring takes the card's own inks (see the render).

  // `done` (optional) overrides the raw boolean — recurring tasks track
  // per-occurrence completion in meta.completedDates, so the CALLER decides
  // what "checked" means in its context (per-day in the day panel, done-now in
  // the Upcoming agenda). Fall back to the plain boolean for old call sites.
  const completed = done !== undefined ? !!done : !!item.completed;

  // "When" line — the date plus the time range, so each upcoming row states
  // exactly when it happens: "Today · 2:30 PM — 3:00 PM", "Tomorrow", etc. The
  // live countdown to the right (TaskCountdownBadge) carries the minute ticker.
  // In a single-day panel the date is redundant (the panel header already shows
  // it), so `hideDate` drops it and the when-line shows just the time range.
  // When a recurring row is checked, `doneDate` (the ticked occurrence) drives
  // the label — otherwise the row would flash the ALREADY-ADVANCED next dueDate
  // ("Tomorrow") the instant you complete it, which reads as a glitch.
  const whenDate = (completed && doneDate) ? doneDate : item.dueDate;
  const dateLabel = (!hideDate && whenDate) ? formatDueDate(whenDate) : '';
  const start = item.time ? fmtTime(item.time, use24h) : '';
  const end = item.time && Number(item.duration) > 0 ? fmtTime(addMinutes(item.time, item.duration), use24h) : '';
  const timePart = start ? (end ? `${start} — ${end}` : start) : '';
  const whenLabel = dateLabel
    ? (timePart ? `${dateLabel} · ${timePart}` : dateLabel)
    : (timePart || whenLabelFallback);

  const typeLabel = { event: 'Event', birthday: 'Birthday' }[itemTypeOf(item)];
  const subtitle = item.project || typeLabel || 'No Board';
  const ownerName = owner?.name?.trim() || null;

  // The card's text column (when-line + title + subtitle). Factored out so an
  // optional `trailing` accessory (e.g. Pending's "add to today" button) can sit
  // beside it in a row without disturbing the plain stacked layout every other
  // caller uses.
  const cardBody = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 12, color: cMuted, flexShrink: 1 }} numberOfLines={1}>{whenLabel}</Text>
        {(ownerName || (!completed && !hideCountdown)) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
            {ownerName && (
              <TouchableOpacity
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  marginRight: !completed && !hideCountdown ? 8 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: owner.color || cSub,
                }}
                onPress={() => onOwnerPress?.(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Owner: ${ownerName}. Open profile`}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                  {ownerName.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}
            {!completed && !hideCountdown && <TaskCountdownBadge task={item} />}
          </View>
        )}
      </View>
      <Text
        style={{ fontSize: 15, fontWeight: '600', color: cText, textDecorationLine: completed ? 'line-through' : 'none' }}
        // Uniform rows cap the title to ONE line — a wrapped title is the
        // one thing that made row heights vary.
        numberOfLines={uniform ? 1 : 2}
      >
        {item.title}
      </Text>
      <Text style={{ fontSize: 13, color: cSub, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>
    </>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: ROW_GAP, paddingHorizontal: 14 }}>
      {/* Time column — the planner's left edge: the start time beside the
          card ("07:00 PM"), a quiet dash for an untimed task. Same size and
          ink as ScheduleCard's column so the agenda and the day panel line up. */}
      <Text
        style={{ width: TIME_COL, paddingTop: 11, paddingRight: 6, fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary, fontVariant: ['tabular-nums'], letterSpacing: 0.1 }}
        numberOfLines={1}
      >
        {item.time ? clockLabel(parseHM(item.time), use24h) : '—'}
      </Text>

      {/* Card */}
      <TouchableOpacity
        {...TAP_ONLY}
        onPress={() => onPress?.(item)}
        onLongPress={() => onLongPress?.(item)}
        activeOpacity={0.75}
        delayLongPress={300}
        style={{
          flex: 1,
          marginLeft: 12,
          backgroundColor: cCardBg,
          borderRadius: 16,
          borderWidth: 1,
          // Board tasks get a hairline border in the board's colour (matches the
          // hatch backdrop); everything else keeps the neutral card border.
          borderColor: hatchColor || cBorder,
          // Inset: the recess catches light along its top edge.
          borderTopColor: hatchColor || inv.edgeTop,
          paddingVertical: 9,
          paddingLeft: 12,
          // Room for the completion ring overlaid on the right edge.
          paddingRight: 12 + DOT + 12,
          opacity: completed ? 0.65 : 1,
          ...inv.shadow,
          // Uniform mode: pixel-exact card height so the row's total height is
          // a constant the agenda's placeholder geometry can rely on.
          ...(uniform ? { height: UNIFORM_CARD_H, justifyContent: 'center' } : {}),
          // With a trailing accessory the card lays out as [text | button].
          ...(trailing ? { flexDirection: 'row', alignItems: 'center' } : {}),
        }}
      >
        {/* Low-opacity diagonal hatch in the board's colour, behind the content
            (callers pass hatchColor when the task belongs to a board). */}
        <HatchBackdrop color={hatchColor} style={{ borderRadius: 12 }} />
        {trailing ? (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>{cardBody}</View>
            {trailing}
          </>
        ) : cardBody}
        {/* Completion ring — INSIDE the card, overlaid on its right edge and
            vertically centred. Done = filled with the card's text colour and a
            check in the card colour; not done = a hairline ring. */}
        <TouchableOpacity
          onPress={() => { tapHaptic(); onToggleComplete?.(item); }}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={completed ? 'Mark not done' : 'Mark done'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 4, elevation: 4 }}
        >
          <View
            style={{
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: completed ? cText : 'transparent',
              borderWidth: completed ? 0 : 1.5,
              borderColor: cText,
            }}
          >
            {completed && <Icon name="check" size={DOT - 8} color={cCardBg} />}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};
