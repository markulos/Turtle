// overviewStats — the Overview page's numbers: per-board + overall counts
// over TASK items only (events / birthdays are not "to do"), plus a tag
// tally. Pure, so it is testable without the page's native imports.
import { isTaskDoneNow, itemTypeOf } from './taskHelpers';

export const NO_BOARD = 'No Project';
const pct = (done, total) => (total > 0 ? Math.round((done / total) * 100) : 0);

function emptyStat() { return { total: 0, done: 0, overdue: 0, today: 0, todayDone: 0 }; }


export function overviewStats(tasks, boards, todayStr) {
  const all = emptyStat();
  const byBoard = new Map();
  for (const name of boards || []) byBoard.set(name, emptyStat());
  const tags = new Map();
  for (const t of tasks || []) {
    if (!t || itemTypeOf(t) !== 'task') continue;
    const done = !!(t.completed || isTaskDoneNow(t, todayStr));
    const late = !done && !!t.dueDate && t.dueDate < todayStr;
    const today = t.dueDate === todayStr;
    const name = t.project || NO_BOARD;
    if (!byBoard.has(name)) byBoard.set(name, emptyStat());
    for (const b of [all, byBoard.get(name)]) {
      b.total += 1;
      if (done) b.done += 1;
      if (late) b.overdue += 1;
      if (today) { b.today += 1; if (done) b.todayDone += 1; }
    }
    for (const tag of (t.tags && t.tags.length ? t.tags : [])) {
      const e = tags.get(tag) || { total: 0, done: 0 };
      e.total += 1; if (done) e.done += 1; tags.set(tag, e);
    }
  }
  const rows = Array.from(byBoard.entries())
    .map(([name, s]) => ({ name, ...s }))
    .filter((r) => r.name !== NO_BOARD || r.total > 0)
    .sort((a, b) => (a.name === NO_BOARD) - (b.name === NO_BOARD) || (b.total - b.done) - (a.total - a.done) || a.name.localeCompare(b.name));
  const tagRows = Array.from(tags.entries()).map(([tag, s]) => ({ tag, ...s })).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
  return { all, rows, tagRows };
}

export default overviewStats;
