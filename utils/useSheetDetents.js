// Bottom sheets with two resting heights, iOS-style.
//
// APP-WIDE RULE (docs/STYLE-RULES.md §4): a card that pops up from below opens
// at its COLLAPSED detent (about 60 % of the screen), a drag UP takes it to
// its EXPANDED detent (nearly the whole screen), and a drag DOWN past the
// collapsed detent closes it. The grab region is the whole card, the scrim
// fades with a closing drag, and a flick decides faster than distance does.
//
// This is the two-detent successor of utils/useSheetDismiss (same idiom:
// PanResponder + RN Animated, capture-phase claim, latest-ref hygiene). A
// sheet that scrolls inside spreads `scrollProps` on its ScrollView so an
// upward drag scrolls the list when the sheet is already expanded, and a
// downward drag only closes when the list is at its top.
//
// Geometry: the card is laid out at its EXPANDED height and anchored to the
// bottom; `offsetY` translates it DOWN by `collapsedOffset` (expanded height −
// collapsed height) when collapsed, 0 when expanded, and beyond
// `collapsedOffset` on a closing pull. Spread `sheetStyle` on the card.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const SCREEN_H = Dimensions.get('window').height || 900;
export const COMMIT_DY = 90;
// PanResponder gesture velocity is in px/MILLISECOND.
export const COMMIT_VY = 0.6;
export const EXPAND_VY = -0.5;
export const DRAG_SLOP = 6;
const TOP_EPSILON = 1;
/** Resistance above the expanded detent. */
const OVERSHOOT = 0.25;

export function isAtTop(offsets) {
  for (const y of offsets.values()) {
    if (y > TOP_EPSILON) return false;
  }
  return true;
}

/**
 * Where a released drag lands. `offset` is the card's current translate
 * (0 = expanded, collapsedOffset = collapsed, more = pulled toward closing).
 */
export function decideDetent({ offset, vy, collapsedOffset }) {
  if (vy > COMMIT_VY || offset > collapsedOffset + COMMIT_DY) return 'close';
  if (vy < EXPAND_VY || offset < collapsedOffset * 0.5) return 'expand';
  return 'collapse';
}

/**
 * The capture-phase claim. Down: only from the top of any inner list. Up:
 * only while collapsed (an expanded sheet's upward drag belongs to its list).
 */
export function shouldClaimDrag(gesture, { blocked, atTop, expanded }) {
  if (blocked) return false;
  if (Math.abs(gesture.dy) <= DRAG_SLOP) return false;
  if (Math.abs(gesture.dy) <= Math.abs(gesture.dx) * 1.2) return false;
  if (gesture.dy > 0) return atTop;
  return !expanded;
}

export function useSheetDetents({ collapsedOffset, onClose, visible = true, startExpanded = false }) {
  const offsetY = useRef(new Animated.Value(startExpanded ? 0 : collapsedOffset)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const collapsedRef = useRef(collapsedOffset);
  collapsedRef.current = collapsedOffset;
  const expandedRef = useRef(startExpanded);
  const currentRef = useRef(startExpanded ? 0 : collapsedOffset);
  const startRef = useRef(0);
  const offsetsRef = useRef(new Map());
  const blockedRef = useRef(false);

  useEffect(() => {
    const id = offsetY.addListener(({ value }) => { currentRef.current = value; });
    return () => offsetY.removeListener(id);
  }, [offsetY]);

  useEffect(() => {
    if (visible) {
      expandedRef.current = startExpanded;
      offsetY.setValue(startExpanded ? 0 : collapsedRef.current);
      offsetsRef.current.clear();
      blockedRef.current = false;
    }
  }, [visible, offsetY, startExpanded]);

  const settle = useCallback((to, velocity = 0) => {
    Animated.spring(offsetY, { toValue: to, velocity, useNativeDriver: true, bounciness: 3 }).start();
  }, [offsetY]);

  const expand = useCallback(() => { expandedRef.current = true; settle(0); }, [settle]);
  const collapse = useCallback(() => { expandedRef.current = false; settle(collapsedRef.current); }, [settle]);
  const close = useCallback(() => {
    Animated.timing(offsetY, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onCloseRef.current?.();
    });
  }, [offsetY]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        shouldClaimDrag(g, {
          blocked: blockedRef.current,
          atTop: isAtTop(offsetsRef.current),
          expanded: expandedRef.current,
        }),
      onPanResponderGrant: () => { startRef.current = currentRef.current; },
      onPanResponderMove: (_e, g) => {
        const raw = startRef.current + g.dy;
        offsetY.setValue(raw < 0 ? raw * OVERSHOOT : raw);
      },
      onPanResponderRelease: (_e, g) => {
        const offset = Math.max(0, startRef.current + g.dy);
        const verdict = decideDetent({ offset, vy: g.vy, collapsedOffset: collapsedRef.current });
        if (verdict === 'close') close();
        else if (verdict === 'expand') { expandedRef.current = true; settle(0, g.vy); }
        else { expandedRef.current = false; settle(collapsedRef.current, g.vy); }
      },
      onPanResponderTerminate: () => {
        settle(expandedRef.current ? 0 : collapsedRef.current);
      },
    }),
  ).current;

  const helpers = useMemo(() => {
    const scrollPropsFor = (key = 'body') => ({
      scrollEventThrottle: 16,
      onScroll: (e) => { offsetsRef.current.set(key, e?.nativeEvent?.contentOffset?.y ?? 0); },
    });
    return {
      scrollPropsFor,
      scrollProps: scrollPropsFor('body'),
      noDragProps: {
        onStartShouldSetResponderCapture: () => { blockedRef.current = true; return false; },
        onTouchEnd: () => { blockedRef.current = false; },
        onTouchCancel: () => { blockedRef.current = false; },
      },
    };
  }, []);

  return {
    offsetY,
    panHandlers: responder.panHandlers,
    sheetStyle: { transform: [{ translateY: offsetY }] },
    expand,
    collapse,
    close,
    expandedRef,
    ...helpers,
  };
}
