import {
  MODE, lockMode, rubberBand, pagerOffset, pageTarget, pageTranslate, settleDuration,
  shouldCommitDismiss, shouldOpenDetails, shouldCommitEdgeBack, dismissScale, dismissBackdrop,
  dismissChrome, splitZoomPan, shouldHandoff, clampIndex, PAGE_DIRECTION, GUTTER,
  SETTLE_MIN_MS, SETTLE_MAX_MS,
} from '../viewerGestureMath';

const W = 390;
const H = 844;

describe('lockMode', () => {
  test('undecided under the lock distance', () => {
    expect(lockMode({ dx: 3, dy: 4, startX: 100, zoomed: false })).toBe(MODE.NONE);
  });
  test('horizontal → page; a slight diagonal stays with the pager', () => {
    expect(lockMode({ dx: 20, dy: 0, startX: 100, zoomed: false })).toBe(MODE.PAGE);
    expect(lockMode({ dx: 20, dy: 22, startX: 100, zoomed: false })).toBe(MODE.PAGE);
  });
  test('dominant vertical: down → dismiss, up → details', () => {
    expect(lockMode({ dx: 2, dy: 30, startX: 100, zoomed: false })).toBe(MODE.DISMISS);
    expect(lockMode({ dx: 2, dy: -30, startX: 100, zoomed: false })).toBe(MODE.DETAILS);
  });
  test('rightward from the left bezel → edge back; leftward from the bezel pages', () => {
    expect(lockMode({ dx: 20, dy: 1, startX: 10, zoomed: false })).toBe(MODE.EDGE_BACK);
    expect(lockMode({ dx: -20, dy: 1, startX: 10, zoomed: false })).toBe(MODE.PAGE);
  });
  test('zoomed → zoom pan whatever the direction', () => {
    expect(lockMode({ dx: 2, dy: 30, startX: 100, zoomed: true })).toBe(MODE.ZOOM_PAN);
  });
});

describe('rubberBand / pagerOffset', () => {
  test('is monotonic, sign-preserving and bounded by the dimension', () => {
    expect(rubberBand(0, W)).toBe(0);
    expect(rubberBand(100, W)).toBeGreaterThan(0);
    expect(rubberBand(100, W)).toBeLessThan(100);
    expect(rubberBand(200, W)).toBeGreaterThan(rubberBand(100, W));
    expect(rubberBand(5000, W)).toBeLessThan(W);
    expect(rubberBand(-100, W)).toBe(-rubberBand(100, W));
  });
  test('follows the finger inside the list, resists past the ends', () => {
    expect(pagerOffset(-120, 1, 5, W)).toBe(-120);
    expect(pagerOffset(120, 1, 5, W)).toBe(120);
    expect(pagerOffset(120, 0, 5, W)).toBeLessThan(120);
    expect(pagerOffset(120, 0, 5, W)).toBeGreaterThan(0);
    expect(pagerOffset(-120, 4, 5, W)).toBeGreaterThan(-120);
    expect(pagerOffset(50, 0, 1, W)).toBeLessThan(50);
  });
});

describe('pageTarget', () => {
  test('a flick pages one step in the flick direction', () => {
    expect(pageTarget({ dx: -40, vx: -900, index: 2, count: 5, width: W })).toBe(1);
    expect(pageTarget({ dx: 40, vx: 900, index: 2, count: 5, width: W })).toBe(-1);
  });
  test('a slow drag pages only past half the width', () => {
    expect(pageTarget({ dx: -150, vx: 0, index: 2, count: 5, width: W })).toBe(0);
    expect(pageTarget({ dx: -200, vx: 0, index: 2, count: 5, width: W })).toBe(1);
  });
  test('never leaves the list', () => {
    expect(pageTarget({ dx: 300, vx: 2000, index: 0, count: 5, width: W })).toBe(0);
    expect(pageTarget({ dx: -300, vx: -2000, index: 4, count: 5, width: W })).toBe(0);
  });
});

describe('pageTranslate', () => {
  test('lays pages out left to right around the active one', () => {
    const pageW = W + GUTTER;
    expect(pageTranslate(3, 3, 0, pageW)).toBe(0);
    expect(pageTranslate(4, 3, 0, pageW)).toBe(pageW * PAGE_DIRECTION);
    expect(pageTranslate(2, 3, -50, pageW)).toBe(-pageW * PAGE_DIRECTION - 50);
  });
});

describe('settleDuration', () => {
  test('stays inside its bounds and shortens with velocity', () => {
    expect(settleDuration(W, 0)).toBeLessThanOrEqual(SETTLE_MAX_MS);
    expect(settleDuration(W, 0)).toBeGreaterThanOrEqual(SETTLE_MIN_MS);
    expect(settleDuration(W, 3000)).toBe(SETTLE_MIN_MS);
    expect(settleDuration(0, 0)).toBe(SETTLE_MIN_MS);
    expect(settleDuration(W, 0)).toBeGreaterThan(settleDuration(W, 1500));
  });
});

describe('commit rules', () => {
  test('dismiss: far enough, or a real downward flick', () => {
    expect(shouldCommitDismiss(120, 0)).toBe(true);
    expect(shouldCommitDismiss(40, 900)).toBe(true);
    expect(shouldCommitDismiss(20, 900)).toBe(false);
    expect(shouldCommitDismiss(60, 100)).toBe(false);
  });
  test('details: an upward pull or flick', () => {
    expect(shouldOpenDetails(-60, 0)).toBe(true);
    expect(shouldOpenDetails(-10, -800)).toBe(true);
    expect(shouldOpenDetails(-10, -100)).toBe(false);
  });
  test('edge back: distance or velocity', () => {
    expect(shouldCommitEdgeBack(90, 0)).toBe(true);
    expect(shouldCommitEdgeBack(30, 700)).toBe(true);
    expect(shouldCommitEdgeBack(30, 100)).toBe(false);
  });
});

describe('dismiss interpolations', () => {
  test('anchor values', () => {
    expect(dismissScale(0, H)).toBe(1);
    expect(dismissScale(H, H)).toBeCloseTo(0.7);
    expect(dismissScale(-50, H)).toBe(1);
    expect(dismissBackdrop(0, H)).toBe(1);
    expect(dismissBackdrop(H, H)).toBe(0);
    expect(dismissChrome(0)).toBe(1);
    expect(dismissChrome(60)).toBe(0);
    expect(dismissChrome(30)).toBeCloseTo(0.5);
  });
});

describe('zoom edge handoff', () => {
  test('splits a pan into the part inside the bound and the spill', () => {
    expect(splitZoomPan(50, 100)).toEqual({ inside: 50, spill: 0 });
    expect(splitZoomPan(150, 100)).toEqual({ inside: 100, spill: 50 });
    expect(splitZoomPan(-150, 100)).toEqual({ inside: -100, spill: -50 });
    expect(splitZoomPan(30, 0)).toEqual({ inside: 0, spill: 30 });
  });
  test('hands off past the ratio or on a flick in the spill direction', () => {
    expect(shouldHandoff(0, -2000, W)).toBe(0);
    expect(shouldHandoff(-W * 0.4, 0, W)).toBe(1);
    expect(shouldHandoff(W * 0.4, 0, W)).toBe(-1);
    expect(shouldHandoff(-20, -900, W)).toBe(1);
    expect(shouldHandoff(-20, 900, W)).toBe(0);
    expect(shouldHandoff(-20, 0, W)).toBe(0);
  });
});

describe('clampIndex', () => {
  test('keeps an index inside the list', () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(7, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(3, 0)).toBe(0);
  });
});
