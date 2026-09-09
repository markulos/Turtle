/**
 * ViewerPage — one page of the viewer. Dumb on purpose.
 *
 * A page is a full-screen absolutely positioned view whose transform is a pure
 * function of the stage's shared values (useAnimatedStyle → no JS on a gesture
 * frame), and whose content is ONE expo-image (or one expo-video view). The
 * image's URI is a pure function of two inputs: the media row, and a per-photo
 * "HD is warm" flag read from MediaGallery's HD store. No dwell timers, no
 * commit latches, no drag subscriptions — every one of those used to live in a
 * cell and could fire React state on the frame a finger landed. All HD
 * orchestration stays in MediaGallery's viewer HD manager, which prefetches the
 * display variant into the disk cache and flips the flag only on quiet frames.
 *
 * Layout (spec §5):
 *   translateX = pageTranslate(index, active, pagerX) + (isActive ? dragX : 0)
 *   translateY = isActive ? dragY : 0
 *   scale      = isActive ? dismissScale(dragY) × (zoomOwner ? scale : 1) : 1
 *   opacity    = isActive ? 1 : (dragY > 0 || openProgress < 1 ? 0 : 1)
 * The zoom transform belongs to `zoomIndex`, which lags `activeIndex` until a
 * page settle finishes, so a zoomed page stays zoomed while it slides out and
 * the incoming page never inherits it. Neighbours vanish during a pull and
 * during the open/close pop, because scaling the active page about its centre
 * would otherwise let the next page peek in from the side.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

import { useMusicPlayer } from '../../../../context/MusicPlayerContext';
import { dismissScale, pageTranslate } from '../../../../utils/viewerGestureMath';
import { useHdReady, useIsActive } from './stores';

function usePageStyle(index, sv) {
  return useAnimatedStyle(() => {
    const active = index === sv.activeIndex.value;
    const zoomOwner = index === sv.zoomIndex.value;
    const x = pageTranslate(index, sv.activeIndex.value, sv.pagerX.value, sv.pageW) + (active ? sv.dragX.value : 0);
    const y = active ? sv.dragY.value : 0;
    const pull = active ? dismissScale(sv.dragY.value, sv.height) : 1;
    const zoom = zoomOwner ? sv.scale.value : 1;
    const zx = zoomOwner ? sv.tx.value : 0;
    const zy = zoomOwner ? sv.ty.value : 0;
    const hidden = !active && (sv.dragY.value > 0 || sv.openProgress.value < 1);
    return {
      opacity: hidden ? 0 : 1,
      transform: [
        { translateX: x + zx },
        { translateY: y + zy },
        { scale: pull * zoom },
      ],
    };
  }, [index, sv]);
}

// ── Photo ────────────────────────────────────────────────────────────────────
const PhotoBody = React.memo(({ item, hdStore, getFullUrl, onAspect }) => {
  const hdReady = useHdReady(hdStore, item.id);
  const hasMetaAspect = item.width > 0 && item.height > 0;

  // Fast source: compressed > thumbnail > raw. Thumbnail before raw on purpose
  // — on tunnel mode or unmigrated rows the raw can be a 25MB HEIC, and
  // streaming it to fill a screen for half a second is the opposite of fast;
  // the thumbnail is ~60KB and always exists.
  const fastUri = item.compressedUrl
    ? getFullUrl(item.compressedUrl)
    : (item.thumbnailUrl
      ? getFullUrl(item.thumbnailUrl)
      : getFullUrl(item.rawUrl || item.url || ''));
  // HD source: the ~1600px display variant. By the time hdReady is true the
  // manager has already prefetched these exact bytes into the disk cache, so
  // this swap decodes from disk — never a cold network fetch on a view.
  const displayUri = getFullUrl(`/api/media/display/${item.id}`);
  const uri = hdReady ? displayUri : fastUri;

  const handleLoad = useCallback((e) => {
    if (hasMetaAspect || !onAspect) return;
    const src = e?.source || e?.nativeEvent?.source || {};
    if (src.width > 0 && src.height > 0) onAspect(item.id, src.width / src.height);
  }, [hasMetaAspect, onAspect, item.id]);

  const handleError = useCallback((e) => {
    // Degraded, not broken: the previous texture stays visible.
    try {
      const native = e?.nativeEvent || e || {};
      console.warn('[PhotoViewer] image load failed:', JSON.stringify({
        uri, mediaId: item.id, hdReady, error: native?.error || native?.message || String(native),
      }));
    } catch { /* logger must never throw */ }
  }, [uri, item.id, hdReady]);

  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFillObject}
      contentFit="contain"
      // Blur-up on first paint, and the SAME native crossfade carries the
      // fast → HD swap in place. No second view, no unmount, no texture
      // teardown.
      transition={160}
      recyclingKey={item.id}
      cachePolicy="memory-disk"
      placeholder={item.blurhash ? { blurhash: item.blurhash } : null}
      placeholderContentFit="cover"
      onLoad={handleLoad}
      onError={handleError}
      accessibilityLabel={item.filename || 'Photo'}
    />
  );
});
PhotoBody.displayName = 'PhotoBody';

// ── Video ────────────────────────────────────────────────────────────────────
const VideoBody = React.memo(({ item, isActive, getFullUrl, onVideoControls }) => {
  const sourceUrl = getFullUrl(item.rawUrl || item.url || '');
  const { pause: pauseMusic } = useMusicPlayer();
  const player = useVideoPlayer(sourceUrl, (p) => {
    p.loop = true;
    p.muted = true;
    // Opening a video preview must NOT stop whatever the music player is
    // playing: 'auto' claims the audio session as soon as playback starts,
    // muted or not. Muted playback mixes; the session is taken only when the
    // user asks to hear this video.
    p.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
      player.muted = true;
      player.audioMixingMode = 'mixWithOthers';
    }
  }, [isActive, player]);

  // The chrome owns the buttons; the active video page lends it the player.
  useEffect(() => {
    if (!isActive || !onVideoControls) return undefined;
    const controls = {
      togglePlay: () => {
        if (player.playing) player.pause(); else player.play();
        return { playing: player.playing, muted: player.muted };
      },
      // Unmuting is the ONLY thing that stops the music: the user explicitly
      // asked to hear this video. Re-muting hands the session back.
      toggleMute: () => {
        const nextMuted = !player.muted;
        player.muted = nextMuted;
        player.audioMixingMode = nextMuted ? 'mixWithOthers' : 'doNotMix';
        if (!nextMuted) pauseMusic?.();
        return { playing: player.playing, muted: player.muted };
      },
      getState: () => ({ playing: player.playing, muted: player.muted }),
    };
    onVideoControls(item.id, controls);
    return () => onVideoControls(item.id, null);
  }, [isActive, player, item.id, onVideoControls, pauseMusic]);

  return (
    <VideoView
      style={StyleSheet.absoluteFillObject}
      player={player}
      contentFit="contain"
      nativeControls={false}
    />
  );
});
VideoBody.displayName = 'VideoBody';

// ── The page ─────────────────────────────────────────────────────────────────
export const ViewerPage = React.memo(({ item, index, sv, activeStore, hdStore, getFullUrl, onAspect, onVideoControls }) => {
  const isActive = useIsActive(activeStore, item.id);
  const style = usePageStyle(index, sv);
  const frame = useMemo(() => ({ width: sv.width, height: sv.height }), [sv.width, sv.height]);

  return (
    <Animated.View
      style={[styles.page, frame, style]}
      collapsable={false}
      pointerEvents="none"
      testID={`viewer-page-${item.id}`}
    >
      <View style={styles.clip}>
        {item.type === 'video' ? (
          <VideoBody item={item} isActive={isActive} getFullUrl={getFullUrl} onVideoControls={onVideoControls} />
        ) : (
          <PhotoBody item={item} hdStore={hdStore} getFullUrl={getFullUrl} onAspect={onAspect} />
        )}
      </View>
    </Animated.View>
  );
});
ViewerPage.displayName = 'ViewerPage';

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});

export default ViewerPage;
