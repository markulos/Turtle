/**
 * PhotoViewer — the vault's full-screen viewer. The shell.
 *
 * Modal → GestureHandlerRootView (a Modal is its own native tree; the app-root
 * one does not reach it) → backdrop → ViewerStage (the one gesture tree, with
 * the active page ±1 inside) → ViewerChrome → the sheets → whatever overlays
 * the gallery needs inside this Modal (share chooser, "preparing" card).
 *
 * The shell owns exactly the state that changes AT REST: the settled index,
 * whether the chrome is shown, whether the photo is zoomed, which sheet is
 * open, the video buttons' state. Everything a finger moves is a shared value
 * (stageValues.js). JS is entered once at pan begin (dragStore true), once at
 * rest (settled index → stores → onIndexSettled), once per zoom flip, and on
 * committed actions — never per frame.
 *
 * Data contract (spec §3.1): `items` is the same reversed list the old
 * FlatList paged; `initialIndex` indexes it; `origin` is the tap point the
 * pop grows from; the three stores are MediaGallery's (activeStore drives the
 * HD manager and the video pages, hdStore the page URIs, dragStore the HD
 * flush gate); the callbacks are MediaGallery's optimistic actions.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, PixelRatio, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  CHROME_FADE_MS,
  CLOSE_MS,
  OPEN_MS,
  clampIndex,
  dismissBackdrop,
} from '../../../../utils/viewerGestureMath';
import { MAX_SCALE, nativeMaxScale } from '../../../../utils/zoomMath';
import DetailsSheet from './DetailsSheet';
import TagsSheet from './TagsSheet';
import ViewerChrome from './ViewerChrome';
import ViewerPage from './ViewerPage';
import ViewerStage from './ViewerStage';
import { useStageValues } from './stageValues';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');
const HOME_SPRING = { damping: 26, stiffness: 260, mass: 1 };
const OPEN_TIMING = { duration: OPEN_MS, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: CLOSE_MS, easing: Easing.in(Easing.quad) };
const noop = () => {};

export default function PhotoViewer({
  visible,
  items,
  initialIndex = 0,
  origin = null,
  activeStore,
  hdStore,
  dragStore,
  getFullUrl,
  tagSuggestions,
  onIndexSettled,
  onCommitTags,
  onToggleFavourite,
  onShare,
  onEditImage,
  onClosed,
  theme,
  insets,
  bottomInset = 24,
  children,
}) {
  const sv = useStageValues(WIN_W, WIN_H);
  const list = items || [];
  const count = list.length;

  const [activeIndex, setActiveIndex] = useState(() => clampIndex(initialIndex, count));
  const [chromeVisible, setChromeVisible] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [videoState, setVideoState] = useState(null);

  const itemsRef = useRef(list);
  itemsRef.current = list;
  const activeIdRef = useRef(null);
  const closingRef = useRef(false);
  const videoControlsRef = useRef(null);
  const aspectByIdRef = useRef(new Map());

  const safeIndex = clampIndex(activeIndex, count);
  const activeItem = count ? list[safeIndex] : null;
  const chromeShown = chromeVisible && !zoomed;

  // ── mirrors into the shared values (all at rest) ─────────────────────────
  useEffect(() => { sv.count.value = count; }, [sv, count]);

  useEffect(() => {
    if (!activeItem) return;
    const hasMeta = activeItem.width > 0 && activeItem.height > 0;
    sv.aspect.value = hasMeta
      ? activeItem.width / activeItem.height
      : (aspectByIdRef.current.get(activeItem.id) || 0);
    sv.maxScale.value = activeItem.width > 0
      ? nativeMaxScale(activeItem.width, WIN_W, PixelRatio.get())
      : MAX_SCALE;
    sv.zoomEnabled.value = activeItem.type === 'video' ? 0 : 1;
  }, [sv, activeItem]);

  useEffect(() => {
    sv.chrome.value = withTiming(chromeShown ? 1 : 0, { duration: CHROME_FADE_MS });
  }, [sv, chromeShown]);

  // ── open ─────────────────────────────────────────────────────────────────
  // Layout effect so the reset state is committed before the first paint of
  // the open Modal — the pages mount around the right index on frame one.
  useLayoutEffect(() => {
    if (!visible) return;
    const start = clampIndex(initialIndex, itemsRef.current.length);
    const first = itemsRef.current[start] || null;
    closingRef.current = false;
    activeIdRef.current = first ? first.id : null;
    videoControlsRef.current = null;

    cancelAnimation(sv.pagerX);
    cancelAnimation(sv.openProgress);
    cancelAnimation(sv.dragX);
    cancelAnimation(sv.dragY);
    sv.pagerX.value = 0;
    sv.activeIndex.value = start;
    sv.zoomIndex.value = start;
    sv.scale.value = 1;
    sv.tx.value = 0;
    sv.ty.value = 0;
    sv.dragX.value = 0;
    sv.dragY.value = 0;
    sv.settling.value = 0;
    sv.chrome.value = 1;
    sv.originX.value = origin ? origin.x - WIN_W / 2 : 0;
    sv.originY.value = origin ? origin.y - WIN_H / 2 : 0;
    sv.openProgress.value = 0;
    sv.openProgress.value = withTiming(1, OPEN_TIMING);

    setActiveIndex(start);
    setChromeVisible(true);
    setZoomed(false);
    setTagsOpen(false);
    setDetailsOpen(false);
    setVideoState(null);
    if (first) activeStore?.set(first.id);
    // `initialIndex` and `origin` are written by the gallery in the same
    // render that flips `visible`; they must not re-run the open sequence on
    // their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── close ────────────────────────────────────────────────────────────────
  const finishClose = useCallback(() => {
    dragStore?.set(false);
    onClosed?.();
  }, [dragStore, onClosed]);

  // `vx`/`vy` arrive from a committed pull (the stage's release velocity);
  // the back button hands a press event and the pinch nothing — both read as
  // zero, so the retreat starts from rest in those cases.
  const close = useCallback((vx, vy) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setTagsOpen(false);
    setDetailsOpen(false);
    cancelAnimation(sv.pagerX);
    sv.settling.value = 0;
    // Unwind any pull while the pop retreats toward the tap origin: the photo
    // flies from the finger back into the grid, carrying the flick it was
    // released with.
    const velocityX = typeof vx === 'number' && Number.isFinite(vx) ? vx : 0;
    const velocityY = typeof vy === 'number' && Number.isFinite(vy) ? vy : 0;
    sv.dragX.value = withSpring(0, { ...HOME_SPRING, velocity: velocityX });
    sv.dragY.value = withSpring(0, { ...HOME_SPRING, velocity: velocityY });
    sv.openProgress.value = withTiming(0, CLOSE_TIMING, () => {
      'worklet';
      runOnJS(finishClose)();
    });
  }, [sv, finishClose]);

  // The active photo disappeared from the list (deleted underneath us).
  useEffect(() => {
    if (!visible || closingRef.current) return;
    const id = activeIdRef.current;
    if (id && !list.some((it) => it && it.id === id)) close();
  }, [visible, list, close]);

  // ── stage callbacks (stable; the gesture tree is rebuilt if these change) ──
  const handleDragBegin = useCallback(() => {
    dragStore?.set(true);
  }, [dragStore]);

  const handleRest = useCallback((index) => {
    const current = itemsRef.current;
    const i = clampIndex(index, current.length);
    const item = current[i] || null;
    activeIdRef.current = item ? item.id : null;
    setActiveIndex(i);
    if (item) activeStore?.set(item.id);
    dragStore?.set(false);
    if (item) onIndexSettled?.(item, i);
  }, [activeStore, dragStore, onIndexSettled]);

  const handleOpenDetails = useCallback(() => setDetailsOpen(true), []);
  const handleSingleTap = useCallback(() => setChromeVisible((v) => !v), []);
  const handleZoomedChange = useCallback((z) => setZoomed(!!z), []);

  // ── page callbacks ───────────────────────────────────────────────────────
  const handleAspect = useCallback((id, aspect) => {
    aspectByIdRef.current.set(id, aspect);
    if (id === activeIdRef.current) sv.aspect.value = aspect;
  }, [sv]);

  const handleVideoControls = useCallback((id, controls) => {
    if (controls) {
      videoControlsRef.current = controls;
      setVideoState(controls.getState());
    } else if (!videoControlsRef.current || id === activeIdRef.current) {
      videoControlsRef.current = null;
      setVideoState(null);
    }
  }, []);

  // ── chrome callbacks ─────────────────────────────────────────────────────
  const handleEdit = useCallback(() => { if (activeItem) onEditImage?.(activeItem); }, [activeItem, onEditImage]);
  const handleTags = useCallback(() => { setDetailsOpen(false); setTagsOpen(true); }, []);
  const handleShare = useCallback(() => { if (activeItem) onShare?.(activeItem); }, [activeItem, onShare]);
  const handleFavourite = useCallback(() => { if (activeItem) onToggleFavourite?.(activeItem); }, [activeItem, onToggleFavourite]);
  const handleTogglePlay = useCallback(() => {
    const next = videoControlsRef.current?.togglePlay();
    if (next) setVideoState(next);
  }, []);
  const handleToggleMute = useCallback(() => {
    const next = videoControlsRef.current?.toggleMute();
    if (next) setVideoState(next);
  }, []);
  const closeTags = useCallback(() => setTagsOpen(false), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const editTagsFromDetails = useCallback(() => { setDetailsOpen(false); setTagsOpen(true); }, []);

  // ── pages: the active one and its two neighbours, keyed by media id ──────
  const pages = useMemo(() => {
    const out = [];
    if (!count) return out;
    const from = Math.max(0, safeIndex - 1);
    const to = Math.min(count - 1, safeIndex + 1);
    for (let i = from; i <= to; i += 1) {
      const item = list[i];
      if (!item || !item.id) continue;
      out.push(
        <ViewerPage
          key={item.id}
          item={item}
          index={i}
          sv={sv}
          activeStore={activeStore}
          hdStore={hdStore}
          getFullUrl={getFullUrl}
          onAspect={handleAspect}
          onVideoControls={handleVideoControls}
        />,
      );
    }
    return out;
  }, [list, count, safeIndex, sv, activeStore, hdStore, getFullUrl, handleAspect, handleVideoControls]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: sv.openProgress.value * dismissBackdrop(sv.dragY.value, sv.height),
  }), [sv]);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root} testID="photo-viewer">
        <StatusBar hidden={!chromeShown} animated />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        <ViewerStage
          sv={sv}
          onDragBegin={handleDragBegin}
          onRest={handleRest}
          onDismiss={close}
          onEdgeBack={close}
          onOpenDetails={handleOpenDetails}
          onSingleTap={handleSingleTap}
          onZoomedChange={handleZoomedChange}
          onPinchDismiss={close}
        >
          {pages}
        </ViewerStage>

        <ViewerChrome
          sv={sv}
          item={activeItem}
          shown={chromeShown}
          insets={insets || { top: 0, bottom: 0 }}
          bottomInset={bottomInset}
          onBack={close}
          onEdit={handleEdit}
          onTags={handleTags}
          onShare={handleShare}
          onToggleFavourite={handleFavourite}
          video={activeItem?.type === 'video' ? videoState : null}
          onTogglePlay={handleTogglePlay}
          onToggleMute={handleToggleMute}
        />

        {tagsOpen && !!activeItem && (
          <TagsSheet
            item={activeItem}
            suggestions={tagSuggestions || []}
            onCommitTags={onCommitTags || noop}
            onClose={closeTags}
            theme={theme}
          />
        )}
        {detailsOpen && !!activeItem && (
          <DetailsSheet
            item={activeItem}
            onEditTags={editTagsFromDetails}
            onClose={closeDetails}
            theme={theme}
          />
        )}

        {children}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000',
  },
});
