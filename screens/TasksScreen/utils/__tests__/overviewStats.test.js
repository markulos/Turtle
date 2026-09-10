// overviewStats: the Overview page's per-board / overall counts.
import { overviewStats } from '../overviewStats';

const T = '2026-09-10';
const task = (o) => ({ id: o.id || o.title, title: o.title, itemType: 'task', ...o });

describe('overviewStats', () => {
  test('counts to do, done, late and today per board and overall; skips events', () => {
    const tasks = [
      task({ title: 'a', project: 'Work', dueDate: '2026-09-01' }),                 // late
      task({ title: 'b', project: 'Work', dueDate: T }),                            // today, open
      task({ title: 'c', project: 'Work', dueDate: T, completed: true }),           // today, done
      task({ title: 'd', project: 'Home' }),
      task({ title: 'e' }),                                                          // no board
      { id: 'ev', title: 'party', itemType: 'event', project: 'Home', dueDate: T }, // not a task
    ];
    const { all, rows } = overviewStats(tasks, ['Work', 'Home', 'Empty'], T);
    expect(all).toEqual({ total: 5, done: 1, overdue: 1, today: 2, todayDone: 1 });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.Work).toMatchObject({ total: 3, done: 1, overdue: 1, today: 2, todayDone: 1 });
    expect(byName.Home).toMatchObject({ total: 1, done: 0 });
    expect(byName.Empty).toMatchObject({ total: 0 });
    expect(byName['No Project']).toMatchObject({ total: 1 });
    // most open work first, the unfiled bucket last
    expect(rows[0].name).toBe('Work');
    expect(rows[rows.length - 1].name).toBe('No Project');
  });

  test('omits the unfiled bucket when nothing is unfiled and tallies tags', () => {
    const { rows, tagRows } = overviewStats([task({ title: 'a', project: 'W', tags: ['x', 'y'], completed: true }), task({ title: 'b', project: 'W', tags: ['x'] })], ['W'], T);
    expect(rows.map((r) => r.name)).toEqual(['W']);
    expect(tagRows).toEqual([{ tag: 'x', total: 2, done: 1 }, { tag: 'y', total: 1, done: 1 }]);
  });
});
