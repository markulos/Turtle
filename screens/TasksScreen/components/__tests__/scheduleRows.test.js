// The day panel's condensed hour timeline: one row per hour from the first
// task to the last task's end — cards on their start hour, dashed empties,
// one "free" row for a long empty stretch.
import { buildCondensedRows, clockLabel, CONDENSE_AFTER_HOURS } from '../ScheduleCard';

const seg = (id, start, dur) => ({ task: { id, title: id }, start, end: start + dur, duration: dur });

describe('buildCondensedRows', () => {
  test('empty schedule → no rows', () => {
    expect(buildCondensedRows([])).toEqual([]);
  });

  test('the reference day: 08 task, 09 free, 10 task, 11 + 12 free, 13 task', () => {
    const rows = buildCondensedRows([seg('a', 8 * 60, 60), seg('b', 10 * 60, 60), seg('c', 13 * 60, 60)]);
    expect(rows.map((r) => [r.kind, r.minute / 60])).toEqual([
      ['task', 8], ['empty', 9], ['task', 10], ['empty', 11], ['empty', 12], ['task', 13],
    ]);
  });

  test('a card stands for every hour it covers; a task starting mid-hour lands on that hour', () => {
    const rows = buildCondensedRows([seg('long', 9 * 60, 150), seg('later', 12 * 60 + 30, 30)]);
    // 09:00 + 150 min ends 11:30 → the next hour is 12, and the 12:30 task IS
    // hour 12's row (no dashed 12 line before it).
    expect(rows.map((r) => [r.kind, r.minute])).toEqual([
      ['task', 9 * 60], ['task', 12 * 60 + 30],
    ]);
  });

  test('a long free stretch collapses into one free row after the first empty hour', () => {
    const rows = buildCondensedRows([seg('am', 8 * 60, 60), seg('pm', 18 * 60, 60)]);
    expect(rows.map((r) => r.kind)).toEqual(['task', 'empty', 'free', 'task']);
    expect(rows[1].minute).toBe(9 * 60);
    expect(rows[2]).toMatchObject({ minute: 10 * 60, minutes: 8 * 60 });
    expect(9 - 1 > CONDENSE_AFTER_HOURS).toBe(true);
  });

  test('overlapping tasks each get a card and never loop', () => {
    const rows = buildCondensedRows([seg('x', 9 * 60, 120), seg('y', 9 * 60 + 30, 30)]);
    expect(rows.map((r) => [r.kind, r.seg && r.seg.task.id])).toEqual([['task', 'x'], ['task', 'y']]);
  });
});

describe('clockLabel', () => {
  test('reads like the planner column', () => {
    expect(clockLabel(8 * 60)).toBe('08 AM');
    expect(clockLabel(13 * 60)).toBe('01 PM');
    expect(clockLabel(12 * 60 + 30)).toBe('12:30 PM');
    expect(clockLabel(0)).toBe('12 AM');
    expect(clockLabel(9 * 60 + 5, true)).toBe('09:05');
  });
});
