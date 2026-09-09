import { decideDetent, shouldClaimDrag, isAtTop, COMMIT_DY } from '../useSheetDetents';

const C = 260; // collapsedOffset: expanded height − collapsed height

describe('decideDetent', () => {
  test('a downward flick or a pull past the collapsed detent closes', () => {
    expect(decideDetent({ offset: C + 20, vy: 0.9, collapsedOffset: C })).toBe('close');
    expect(decideDetent({ offset: C + COMMIT_DY + 1, vy: 0, collapsedOffset: C })).toBe('close');
  });
  test('an upward flick or crossing half-way expands', () => {
    expect(decideDetent({ offset: C - 10, vy: -0.8, collapsedOffset: C })).toBe('expand');
    expect(decideDetent({ offset: C * 0.4, vy: 0, collapsedOffset: C })).toBe('expand');
  });
  test('a short pull settles back to collapsed', () => {
    expect(decideDetent({ offset: C - 30, vy: 0, collapsedOffset: C })).toBe('collapse');
    expect(decideDetent({ offset: C + 30, vy: 0.1, collapsedOffset: C })).toBe('collapse');
  });
});

describe('shouldClaimDrag', () => {
  const g = (dx, dy) => ({ dx, dy });
  test('needs a vertical drag past the slop', () => {
    expect(shouldClaimDrag(g(0, 4), { blocked: false, atTop: true, expanded: false })).toBe(false);
    expect(shouldClaimDrag(g(40, 20), { blocked: false, atTop: true, expanded: false })).toBe(false);
  });
  test('down only from the top of the list; up only while collapsed', () => {
    expect(shouldClaimDrag(g(0, 30), { blocked: false, atTop: true, expanded: true })).toBe(true);
    expect(shouldClaimDrag(g(0, 30), { blocked: false, atTop: false, expanded: true })).toBe(false);
    expect(shouldClaimDrag(g(0, -30), { blocked: false, atTop: true, expanded: false })).toBe(true);
    expect(shouldClaimDrag(g(0, -30), { blocked: false, atTop: true, expanded: true })).toBe(false);
    expect(shouldClaimDrag(g(0, 30), { blocked: true, atTop: true, expanded: false })).toBe(false);
  });
});

test('isAtTop', () => {
  expect(isAtTop(new Map())).toBe(true);
  expect(isAtTop(new Map([['body', 0.5]]))).toBe(true);
  expect(isAtTop(new Map([['body', 12]]))).toBe(false);
});
