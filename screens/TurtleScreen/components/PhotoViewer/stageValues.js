/**
 * The viewer's shared values — one bundle, created by the shell, read by the
 * stage (gestures), every page (its own transform) and the chrome (opacity).
 *
 * Everything the finger can move lives here, on the UI thread. React state in
 * the shell only mirrors what changes AT REST (the settled index, whether the
 * chrome is shown, whether the photo is zoomed), which is what keeps a render
 * from ever landing on a gesture frame.
 *
 * Units: points, in the stage's own frame (full screen). Translations are
 * relative to the page's resting centre.
 */
import { useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { GUTTER } from '../../../../utils/viewerGestureMath';
import { MAX_SCALE } from '../../../../utils/zoomMath';

export function useStageValues(width, height) {
  /** Horizontal pager offset: 0 at rest, follows the finger, settles back to 0 after a re-base. */
  const pagerX = useSharedValue(0);
  /** The page at offset 0. Changes instantly on a page commit (the re-base). */
  const activeIndex = useSharedValue(0);
  /** The page that owns the zoom transform — lags activeIndex until a settle. */
  const zoomIndex = useSharedValue(0);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** Pull-to-dismiss follow, both axes. */
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  /** 0 → 1 on open; back to 0 on close. Drives the pop, the backdrop, the chrome. */
  const openProgress = useSharedValue(0);
  /** 1 while a page settle animation runs. */
  const settling = useSharedValue(0);
  /** items.length, mirrored so worklets can clamp. */
  const count = useSharedValue(0);
  /** Active image's aspect ratio (w/h), 0 = unknown → container bounds. */
  const aspect = useSharedValue(0);
  /** Chrome opacity target (1 shown, 0 hidden), animated by the shell. */
  const chrome = useSharedValue(1);
  /** Tap origin offset from screen centre — where the pop grows from. */
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  /** 1 for a photo, 0 for a video (no pinch / double-tap). */
  const zoomEnabled = useSharedValue(1);
  /** Zoom ceiling for the active photo (from its source pixels). */
  const maxScale = useSharedValue(MAX_SCALE);

  // Shared values are stable refs, so the bundle only changes with the
  // geometry — and the geometry is fixed for the viewer's life.
  return useMemo(() => ({
    pagerX, activeIndex, zoomIndex, scale, tx, ty, dragX, dragY, openProgress, settling, count,
    aspect, chrome, originX, originY, zoomEnabled, maxScale,
    pageW: width + GUTTER,
    width,
    height,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [width, height]);
}
