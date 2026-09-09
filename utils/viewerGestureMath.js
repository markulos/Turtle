/**
 * viewerGestureMath — the photo viewer's paging, dismiss and zoom-handoff
 * arithmetic, as pure functions.
 *
 * Every function here is a worklet: it is called from Gesture Handler
 * callbacks running on the UI thread, so nothing in this file may touch React,
 * closures over component state, or any helper that isn't itself a worklet.
 * Plain numbers in, plain numbers out — which is also what makes the whole
 * gesture model unit-testable without a device.
 *
 * The zoom surface's own math (focal pinch, pan bounds, rubber clamps, fill
 * and native max scale) lives in ./zoomMath and is reused unchanged.
 *
 * Direction: `PAGE_DIRECTION` is the ONE knob. The viewer walks the same
 * reversed list the old FlatList paged and lays index → x out exactly as that
 * list did (index grows to the right), so the device-confirmed "swipe-right →
 * latest" behaviour is inherited by construction. Flip this constant — and
 * nothing else — if a phone ever disagrees.
 */

export const MODE = Object.freeze({
  NONE: 0,
  PAGE: 1,
  DISMISS: 2,
  DETAILS: 3,
  EDGE_BACK: 4,
  ZOOM_PAN: 5,
});

export const PAGE_DIRECTION = 1;
/** Black gap between pages, pt (iOS Photos' gutter). */
export const GUTTER = 24;
/** Travel before a pan commits to a mode. */
export const AXIS_LOCK_DISTANCE = 8;
/** `|dy| > |dx| × bias` → the pan is vertical. A true diagonal stays with the pager. */
export const VERTICAL_BIAS = 1.2;
export const EDGE_BACK_ZONE = 24;
export const EDGE_BACK_COMMIT_DX = 80;
export const EDGE_BACK_COMMIT_VX = 500;
/** pt/s — Gesture Handler velocities are per second. */
export const PAGE_FLICK_VELOCITY = 400;
export const PAGE_DISTANCE_RATIO = 0.5;
/** UIScrollView's bounce coefficient. */
export const END_RUBBER = 0.55;
export const SETTLE_MIN_MS = 200;
export const SETTLE_MAX_MS = 320;
export const DISMISS_COMMIT_DY = 100;
export const DISMISS_FLICK_VY = 700;
export const DISMISS_FLICK_MIN_DY = 30;
export const DISMISS_SCALE_MIN = 0.7;
export const DISMISS_SCALE_SPAN_RATIO = 0.55;
export const DISMISS_BACKDROP_SPAN_RATIO = 0.45;
export const DISMISS_CHROME_SPAN = 60;
export const DETAILS_COMMIT_DY = -50;
export const DETAILS_COMMIT_VY = -500;
/** A zoomed photo spilled past this fraction of the width pages on release. */
export const ZOOM_HANDOFF_RATIO = 0.3;
export const ZOOMED_EPSILON = 1.01;
/** Pinching an unzoomed photo below this RAW scale closes the viewer. */
export const PINCH_DISMISS_SCALE = 0.72;
/** Below 1× the photo tracks the fingers almost 1:1 toward the grid. */
export const UNDERSCALE_RUBBER = 0.9;
export const OPEN_MS = 200;
export const CLOSE_MS = 150;
export const CHROME_FADE_MS = 200;

/**
 * Decide what a pan is, once, from its first real travel.
 * Returns MODE.NONE while the finger hasn't moved far enough to say.
 */
export function lockMode({ dx, dy, startX, zoomed }) {
  'worklet';
  if (zoomed) return MODE.ZOOM_PAN;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < AXIS_LOCK_DISTANCE && ay < AXIS_LOCK_DISTANCE) return MODE.NONE;
  const vertical = ay > ax * VERTICAL_BIAS;
  if (!vertical && startX < EDGE_BACK_ZONE && dx > 0) return MODE.EDGE_BACK;
  if (vertical) return dy > 0 ? MODE.DISMISS : MODE.DETAILS;
  return MODE.PAGE;
}

/**
 * UIScrollView's rubber band: the further past the edge, the less each point
 * of finger travel moves the content; never reaches `dim`. Sign-preserving.
 */
export function rubberBand(overflow, dim, coeff = END_RUBBER) {
  'worklet';
  if (overflow === 0 || dim <= 0) return 0;
  const sign = overflow < 0 ? -1 : 1;
  const o = Math.abs(overflow);
  return sign * (1 - 1 / ((o * coeff) / dim + 1)) * dim;
}

/** The pager offset for a raw drag: 1:1 inside the list, rubber past its ends. */
export function pagerOffset(dx, index, count, width) {
  'worklet';
  const atFirst = index <= 0;
  const atLast = index >= count - 1;
  const towardsPrevious = dx * PAGE_DIRECTION > 0;
  if ((towardsPrevious && atFirst) || (!towardsPrevious && atLast)) return rubberBand(dx, width);
  return dx;
}

/**
 * Where a page drag lands on release: -1 / 0 / +1 index steps. Velocity wins,
 * then distance past half a page; never a step that leaves the list, and
 * never more than one page per swipe (iOS Photos).
 */
export function pageTarget({ dx, vx, index, count, width }) {
  'worklet';
  let step = 0;
  if (Math.abs(vx) > PAGE_FLICK_VELOCITY) step = vx < 0 ? 1 : -1;
  else if (Math.abs(dx) > width * PAGE_DISTANCE_RATIO) step = dx < 0 ? 1 : -1;
  step *= PAGE_DIRECTION;
  const next = index + step;
  if (next < 0 || next > count - 1) return 0;
  return step;
}

/** A page's x for the current pager state (index grows to the right). */
export function pageTranslate(index, activeIndex, pagerX, pageW) {
  'worklet';
  return (index - activeIndex) * pageW * PAGE_DIRECTION + pagerX;
}

/** Page settle time: longer for more distance, shorter for a harder flick. */
export function settleDuration(remaining, velocity) {
  'worklet';
  const ms = SETTLE_MIN_MS + Math.abs(remaining) * 0.3 - Math.abs(velocity) * 0.04;
  return Math.min(SETTLE_MAX_MS, Math.max(SETTLE_MIN_MS, ms));
}

export function shouldCommitDismiss(dy, vy) {
  'worklet';
  return dy > DISMISS_COMMIT_DY || (dy > DISMISS_FLICK_MIN_DY && vy > DISMISS_FLICK_VY);
}

export function shouldOpenDetails(dy, vy) {
  'worklet';
  return dy < DETAILS_COMMIT_DY || vy < DETAILS_COMMIT_VY;
}

export function shouldCommitEdgeBack(dx, vx) {
  'worklet';
  return dx > EDGE_BACK_COMMIT_DX || vx > EDGE_BACK_COMMIT_VX;
}

function unit(value, span) {
  'worklet';
  if (span <= 0) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value / span));
}

/** 1 → 0.7 across the first 55% of a pull. */
export function dismissScale(dy, height) {
  'worklet';
  return 1 - (1 - DISMISS_SCALE_MIN) * unit(dy, height * DISMISS_SCALE_SPAN_RATIO);
}

/** Backdrop 1 → 0 across the first 45% of a pull. */
export function dismissBackdrop(dy, height) {
  'worklet';
  return 1 - unit(dy, height * DISMISS_BACKDROP_SPAN_RATIO);
}

/** Chrome clears out within the first 60pt of a pull. */
export function dismissChrome(dy) {
  'worklet';
  return 1 - unit(dy, DISMISS_CHROME_SPAN);
}

/**
 * A zoomed pan against its horizontal bound: the part the photo can still
 * absorb, and the part that spills into the pager (the iOS edge handoff).
 */
export function splitZoomPan(desired, bound) {
  'worklet';
  const limit = bound > 0 ? bound : 0;
  const inside = Math.min(limit, Math.max(-limit, desired));
  return { inside, spill: desired - inside };
}

/**
 * Does a spilled zoomed pan become a page change on release? Only when the
 * pager has actually moved; then past the ratio, or on a flick that agrees
 * with the spill direction.
 */
export function shouldHandoff(pagerX, vx, width) {
  'worklet';
  if (pagerX === 0) return 0;
  const step = pagerX < 0 ? 1 : -1;
  if (Math.abs(pagerX) > width * ZOOM_HANDOFF_RATIO) return step * PAGE_DIRECTION;
  const flick = Math.abs(vx) > PAGE_FLICK_VELOCITY && (vx < 0) === (pagerX < 0);
  return flick ? step * PAGE_DIRECTION : 0;
}

export function clampIndex(index, count) {
  'worklet';
  if (!(count > 0)) return 0;
  return Math.min(count - 1, Math.max(0, index));
}
