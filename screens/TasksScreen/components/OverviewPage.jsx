/**
 * OverviewPage — task stats for every board, on a page that overlays the
 * calendar (an in-tree EdgeSwipePage overlay: slides in from the right,
 * left-edge swipe back; sibling Modals like FilterMenu / TaskDetail still
 * present over it).
 *
 * Reads like the reference stat tile (docs/STYLE-RULES.md §1, inset cards):
 * four inset tiles on top — To do, Done, Late, Today — each an icon tile, a
 * big bold figure and a muted caption; then one inset row per board with its
 * colour dot, done / total, a to-do · late caption, a hairline progress track
 * and "shared by …" where the board is someone else's. A row drills into the
 * board: its tags, then the actual to-do and done lists, with a key to show
 * that board on the calendar. Tags get their own section at the end.
 *
 * The tag / owner filters live here too (the funnel key in the header), since
 * the Tasks header gave its filter key to this page.
 */
import React, { memo, useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import EdgeSwipePage from '../../TurtleScreen/components/EdgeSwipePage';
import { tapHaptic } from '../../../utils/haptics';
import { insetCardPalette } from '../utils/cardPalette';
import { boardLabel, isTaskDoneNow, itemTypeOf, localTodayStr } from '../utils/taskHelpers';
import { overviewStats, NO_BOARD } from '../utils/overviewStats';

const pct = (done, total) => (total > 0 ? Math.round((done / total) * 100) : 0);

function Tile({ icon, label, value, caption, pal, accent, testID }) {
  return (
    <View style={[styles.tile, { backgroundColor: pal.card, borderColor: pal.edge, borderTopColor: pal.edgeTop }]} testID={testID}>
      <View style={styles.tileTop}>
        <View style={[styles.iconTile, { backgroundColor: pal.tile }]}>
          <Icon name={icon} size={15} color={accent || pal.text} />
        </View>
        <Text style={[styles.label, { color: pal.muted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: accent || pal.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.caption, { color: pal.muted }]} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

function Track({ done, total, pal, color }) {
  return (
    <View style={[styles.track, { backgroundColor: pal.track }]}>
      <View style={[styles.fill, { width: `${pct(done, total)}%`, backgroundColor: color || pal.text }]} />
    </View>
  );
}

function BoardRow({ row, dot, sharedBy, selected, pal, onPress }) {
  const open = row.total - row.done;
  return (
    <Pressable
      onPressIn={() => tapHaptic()}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${boardLabel(row.name)}: ${row.done} of ${row.total} done${row.overdue ? `, ${row.overdue} late` : ''}`}
      testID={`overview-board-${row.name}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pal.card, borderColor: selected ? pal.text : pal.edge, borderTopColor: selected ? pal.text : pal.edgeTop },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={[styles.rowName, { color: pal.text }]} numberOfLines={1}>{boardLabel(row.name)}</Text>
        <Text style={[styles.rowFigure, { color: pal.text }]} numberOfLines={1}>
          {row.done}<Text style={[styles.rowFigureTotal, { color: pal.sub }]}>/{row.total}</Text>
        </Text>
        <Icon name="chevron-right" size={18} color={pal.muted} />
      </View>
      <Text style={[styles.rowCaption, { color: pal.muted }]} numberOfLines={1}>
        {row.total === 0 ? 'Empty' : open === 0 ? 'All clear' : `${open} to do`}
        {row.overdue > 0 ? <Text style={styles.late}> · {row.overdue} late</Text> : null}
        {row.today > 0 ? ` · ${row.today} today` : ''}
        {sharedBy ? ` · shared by ${sharedBy}` : ''}
      </Text>
      <Track done={row.done} total={row.total} pal={pal} />
    </Pressable>
  );
}

function TaskRow({ t, done, todayStr, pal }) {
  const overdue = !done && t.dueDate && t.dueDate < todayStr;
  return (
    <View style={[styles.taskRow, { borderBottomColor: pal.border }]}>
      <Icon
        name={done ? 'check-circle' : overdue ? 'alert-circle-outline' : 'circle-outline'}
        size={18}
        color={done ? pal.text : overdue ? '#F87171' : pal.muted}
      />
      <Text style={[styles.taskTitle, { color: done ? pal.muted : pal.text }, done && styles.taskDone]} numberOfLines={1}>{t.title || 'Untitled'}</Text>
      <Text style={[styles.taskMeta, { color: overdue ? '#F87171' : pal.muted }]} numberOfLines={1}>
        {t.dueDate ? (t.dueDate === todayStr ? 'Today' : t.dueDate.slice(5)) + (t.time ? ` · ${t.time}` : '') : '—'}
      </Text>
    </View>
  );
}

function PageHeader({ title, onBack, right, theme }) {
  const c = theme.colors;
  return (
    <View style={[styles.topBar, { borderBottomColor: c.border }]}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.backKey, pressed && styles.pressed]}>
        <Icon name="chevron-left" size={28} color={c.textPrimary} />
      </Pressable>
      <Text style={[styles.topTitle, { color: c.textPrimary }]} numberOfLines={1}>{title}</Text>
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

function TagRows({ rows, pal }) {
  return rows.map((r) => (
    <View key={r.tag} style={[styles.tagRow, { backgroundColor: pal.card, borderColor: pal.edge, borderTopColor: pal.edgeTop }]}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowName, { color: pal.text }]} numberOfLines={1}>{r.tag}</Text>
        <Text style={[styles.rowFigure, { color: pal.text }]}>{r.done}<Text style={[styles.rowFigureTotal, { color: pal.sub }]}>/{r.total}</Text></Text>
      </View>
      <Track done={r.done} total={r.total} pal={pal} />
    </View>
  ));
}

function BoardDetail({ row, tasks, todayStr, pal, theme, onBack, onShow, isShown }) {
  const pending = tasks.filter((t) => !(t.completed || isTaskDoneNow(t, todayStr))).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const done = tasks.filter((t) => t.completed || isTaskDoneNow(t, todayStr)).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const tags = new Map();
  for (const t of tasks) for (const tag of (t.tags || [])) { const e = tags.get(tag) || { total: 0, done: 0 }; e.total += 1; if (t.completed) e.done += 1; tags.set(tag, e); }
  const tagRows = Array.from(tags.entries()).map(([tag, s]) => ({ tag, ...s })).sort((a, b) => b.total - a.total);
  const c = theme.colors;
  return (
    <View style={[styles.page, { backgroundColor: c.background }]}>
      <PageHeader
        title={boardLabel(row.name)}
        onBack={onBack}
        theme={theme}
        right={(
          <Pressable
            onPressIn={() => tapHaptic()}
            onPress={onShow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isShown ? 'Showing on calendar' : `Show ${boardLabel(row.name)} on calendar`}
            testID="overview-show-board"
            style={({ pressed }) => [styles.pill, { borderColor: c.borderStrong }, isShown && { backgroundColor: c.textPrimary, borderColor: c.textPrimary }, pressed && styles.pressed]}
          >
            <Text style={[styles.pillText, { color: isShown ? c.background : c.textTertiary }]} numberOfLines={1}>{isShown ? 'Showing' : 'Show'}</Text>
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator scrollIndicatorInsets={{ right: 1 }} indicatorStyle={theme.mode === 'dark' ? 'white' : 'black'}>
        <View style={styles.tiles}>
          <Tile icon="checkbox-blank-circle-outline" label="To do" value={row.total - row.done} caption={`of ${row.total}`} pal={pal} testID="board-tile-todo" />
          <Tile icon="check" label="Done" value={row.done} caption={`${pct(row.done, row.total)}% complete`} pal={pal} testID="board-tile-done" />
          <Tile icon="alert-circle-outline" label="Late" value={row.overdue} caption={row.overdue ? 'past due' : 'nothing late'} pal={pal} accent={row.overdue ? '#F87171' : null} testID="board-tile-late" />
          <Tile icon="calendar-today" label="Today" value={row.today} caption={row.today ? `${row.todayDone} done` : 'nothing due'} pal={pal} testID="board-tile-today" />
        </View>
        {tagRows.length > 0 && (
          <>
            <Text style={[styles.section, { color: c.textTertiary }]}>Tags</Text>
            <TagRows rows={tagRows} pal={pal} />
          </>
        )}
        <Text style={[styles.section, { color: c.textTertiary }]}>To do · {pending.length}</Text>
        {pending.length === 0 ? <Text style={[styles.empty, { color: pal.muted }]}>All clear.</Text> : pending.map((t) => <TaskRow key={t.id} t={t} done={false} todayStr={todayStr} pal={pal} />)}
        <Text style={[styles.section, { color: c.textTertiary }]}>Done · {done.length}</Text>
        {done.length === 0 ? <Text style={[styles.empty, { color: pal.muted }]}>None yet.</Text> : done.map((t) => <TaskRow key={t.id} t={t} done todayStr={todayStr} pal={pal} />)}
      </ScrollView>
    </View>
  );
}

function OverviewPage({
  visible, onClose, tasks, boards, colorOf, sharedIn, selectedProject, calendarDate,
  onSelectBoard, onOpenFilters, filterCount = 0, bottomInset = 0, theme,
}) {
  const insets = useSafeAreaInsets();
  const pal = useMemo(() => insetCardPalette(theme), [theme]);
  const c = theme.colors;
  const todayStr = localTodayStr();
  const { all, rows, tagRows } = useMemo(() => overviewStats(tasks, boards, todayStr), [tasks, boards, todayStr]);
  const [board, setBoard] = useState(null);
  useEffect(() => { if (!visible) setBoard(null); }, [visible]);
  const detailRow = board ? rows.find((r) => r.name === board) : null;
  const detailTasks = useMemo(() => (board ? (tasks || []).filter((t) => t && itemTypeOf(t) === 'task' && (t.project || NO_BOARD) === board) : []), [tasks, board]);
  const dayLabel = (calendarDate instanceof Date ? calendarDate : new Date()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <EdgeSwipePage visible={visible} onClose={onClose} overlay swipeEnabled={!board}>
      <View style={[styles.page, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <PageHeader
          title="Overview"
          onBack={onClose}
          theme={theme}
          right={(
            <Pressable
              onPressIn={() => tapHaptic()}
              onPress={onOpenFilters}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={filterCount ? `Filters, ${filterCount} active` : 'Filters'}
              testID="overview-filters"
              style={({ pressed }) => [styles.iconKey, { borderColor: c.borderStrong }, filterCount > 0 && { backgroundColor: c.textPrimary, borderColor: c.textPrimary }, pressed && styles.pressed]}
            >
              <Icon name="filter-variant" size={18} color={filterCount > 0 ? c.background : c.textTertiary} />
              {filterCount > 0 && (
                <View style={[styles.badge, { backgroundColor: c.background }]}>
                  <Text style={[styles.badgeText, { color: c.textPrimary }]}>{filterCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: 32 + Math.max(insets.bottom, bottomInset) }]}
          showsVerticalScrollIndicator
          scrollIndicatorInsets={{ right: 1 }}
          indicatorStyle={theme.mode === 'dark' ? 'white' : 'black'}
        >
          <View style={styles.tiles}>
            <Tile icon="checkbox-blank-circle-outline" label="To do" value={all.total - all.done} caption={`of ${all.total} tasks`} pal={pal} testID="overview-tile-todo" />
            <Tile icon="check" label="Done" value={all.done} caption={`${pct(all.done, all.total)}% complete`} pal={pal} testID="overview-tile-done" />
            <Tile icon="alert-circle-outline" label="Late" value={all.overdue} caption={all.overdue ? 'past due' : 'nothing late'} pal={pal} accent={all.overdue ? '#F87171' : null} testID="overview-tile-late" />
            <Tile icon="calendar-today" label="Today" value={all.today} caption={all.today ? `${dayLabel} · ${all.todayDone} done` : dayLabel} pal={pal} testID="overview-tile-today" />
          </View>

          <Text style={[styles.section, { color: c.textTertiary }]}>Boards · {rows.length}</Text>
          {rows.length === 0 && <Text style={[styles.empty, { color: pal.muted }]}>No boards yet.</Text>}
          {rows.map((row) => (
            <BoardRow
              key={row.name}
              row={row}
              dot={row.name === NO_BOARD ? pal.muted : colorOf(row.name)}
              sharedBy={sharedIn?.[row.name]}
              selected={selectedProject === row.name}
              pal={pal}
              onPress={() => setBoard(row.name)}
            />
          ))}

          {tagRows.length > 0 && (
            <>
              <Text style={[styles.section, { color: c.textTertiary }]}>Tags · {tagRows.length}</Text>
              <TagRows rows={tagRows} pal={pal} />
            </>
          )}
        </ScrollView>
      </View>

      {/* Board drill-down: a nested in-tree overlay so the back-swipe stack
          holds (overview → board → back). */}
      <EdgeSwipePage overlay visible={!!detailRow} onClose={() => setBoard(null)}>
        {detailRow && (
          <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.background }}>
            <BoardDetail
              row={detailRow}
              tasks={detailTasks}
              todayStr={todayStr}
              pal={pal}
              theme={theme}
              onBack={() => setBoard(null)}
              isShown={selectedProject === detailRow.name}
              onShow={() => onSelectBoard(detailRow.name)}
            />
          </View>
        )}
      </EdgeSwipePage>
    </EdgeSwipePage>
  );
}

export default memo(OverviewPage);

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backKey: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  topRight: { minWidth: 36, alignItems: 'flex-end' },
  iconKey: { width: 36, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9, fontWeight: '800' },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 120 },
  pillText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  body: { paddingHorizontal: 16, paddingTop: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconTile: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  value: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, marginTop: 2 },
  section: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  empty: { fontSize: 13, paddingVertical: 8 },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  tagRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700' },
  rowFigure: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  rowFigureTotal: { fontSize: 12, fontWeight: '600' },
  rowCaption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginTop: 3, paddingLeft: 16 },
  late: { color: '#F87171' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  fill: { height: 3 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  taskTitle: { flex: 1, fontSize: 14 },
  taskDone: { textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 12, flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
