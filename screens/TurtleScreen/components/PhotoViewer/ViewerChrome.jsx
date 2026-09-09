/**
 * ViewerChrome — the two bands over the photo, and nothing else.
 *
 * Top: a gradient wash with Back on the left and Edit (images only) + Tags on
 * the right. Bottom: the timestamp and resolution on the left, a pill with
 * Share and Favourite on the right (plus play/pause and mute for a video),
 * and — for a video — a scrubber above them: elapsed / duration and a track
 * you can drag to seek.
 *
 * Deliberately flat. Both bands are `box-none` while shown, so only the
 * buttons (and the scrubber track) are touch targets and every other touch
 * falls straight through to the stage; `none` while hidden, so an invisible
 * button can never eat a swipe. Opacity is ONE animated style — open
 * progress × chrome target × the pull-to-dismiss fade — with no per-element
 * products and no measurements. The old chrome multiplied four Animated
 * values per element and toggled pointerEvents from three different pieces of
 * state; that complexity sat on the exact path a swipe had to cross.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { dismissChrome } from '../../../../utils/viewerGestureMath';
import { formatViewerResolution, formatViewerTimestamp, isFavourite } from '../../../../utils/viewerFormat';

const HIT = { top: 12, bottom: 12, left: 12, right: 12 };
const SHADOW = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4 };

function ChromeButton({ icon, label, onPress, color = '#fff', size = 26, testID }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} size={size} color={color} style={SHADOW} />
    </Pressable>
  );
}

export function formatClock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * The video timeline. The track owns its own touches through the RN
 * responder system (it sits in the chrome band, above the stage, so the
 * stage's gesture tree never sees them): touch anywhere on it to jump, drag to
 * scrub. While the finger is down the thumb follows the finger, not the
 * player, so a laggy seek can't make it stutter backwards.
 */
function VideoScrubber({ currentTime, duration, onSeek }) {
  const [trackW, setTrackW] = useState(0);
  const [scrubRatio, setScrubRatio] = useState(null);
  const trackWRef = useRef(0);
  trackWRef.current = trackW;

  const ratioAt = useCallback((locationX) => {
    const w = trackWRef.current;
    if (!(w > 0)) return 0;
    return Math.min(1, Math.max(0, locationX / w));
  }, []);

  const seekTo = useCallback((ratio) => {
    if (duration > 0) onSeek?.(ratio * duration);
  }, [duration, onSeek]);

  const played = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const shown = scrubRatio == null ? played : scrubRatio;

  return (
    <View style={styles.scrubber} pointerEvents="box-none" testID="viewer-scrubber">
      <Text style={styles.clock}>{formatClock(scrubRatio == null ? currentTime : scrubRatio * duration)}</Text>
      <View
        style={styles.trackHit}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => { const r = ratioAt(e.nativeEvent.locationX); setScrubRatio(r); seekTo(r); }}
        onResponderMove={(e) => { const r = ratioAt(e.nativeEvent.locationX); setScrubRatio(r); seekTo(r); }}
        onResponderRelease={(e) => { const r = ratioAt(e.nativeEvent.locationX); seekTo(r); setScrubRatio(null); }}
        onResponderTerminate={() => setScrubRatio(null)}
        accessibilityRole="adjustable"
        accessibilityLabel="Video position"
        testID="viewer-scrubber-track"
      >
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${shown * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${shown * 100}%` }]} />
      </View>
      <Text style={styles.clock}>{formatClock(duration)}</Text>
    </View>
  );
}

function ViewerChrome({
  sv,
  item,
  shown,
  insets,
  bottomInset,
  onBack,
  onEdit,
  onTags,
  onShare,
  onToggleFavourite,
  video,
  onTogglePlay,
  onToggleMute,
  onSeek,
}) {
  const fade = useAnimatedStyle(() => ({
    opacity: sv.openProgress.value * sv.chrome.value * dismissChrome(sv.dragY.value),
  }), [sv]);

  const events = shown ? 'box-none' : 'none';
  const isVideo = item?.type === 'video';
  const favourite = isFavourite(item);
  const timestamp = formatViewerTimestamp(item);
  const resolution = formatViewerResolution(item);

  return (
    <>
      <Animated.View
        pointerEvents={events}
        style={[styles.top, { height: insets.top + 68 }, fade]}
        testID="viewer-chrome-top"
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.26)', 'transparent']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.topRow, { top: insets.top + 6 }]} pointerEvents="box-none">
          <ChromeButton icon="chevron-left" label="Back" onPress={onBack} size={32} testID="viewer-back" />
          <View style={styles.topRight} pointerEvents="box-none">
            {!isVideo && <ChromeButton icon="pencil" label="Edit image" onPress={onEdit} testID="viewer-edit" />}
            <ChromeButton icon="tag-multiple" label="Edit tags" onPress={onTags} testID="viewer-tags" />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={events}
        style={[styles.bottom, { bottom: bottomInset }, fade]}
        testID="viewer-chrome-bottom"
      >
        {isVideo && !!video && (
          <VideoScrubber currentTime={video.currentTime || 0} duration={video.duration || 0} onSeek={onSeek} />
        )}
        <View style={styles.bottomRow} pointerEvents="box-none">
          <View style={styles.meta} pointerEvents="none">
            {!!timestamp && <Text style={styles.timestamp} numberOfLines={1}>{timestamp}</Text>}
            {!!resolution && <Text style={styles.resolution} numberOfLines={1}>{resolution}</Text>}
          </View>
          <View style={styles.pill} pointerEvents="box-none">
            {isVideo && !!video && (
              <>
                <ChromeButton
                  icon={video.playing ? 'pause' : 'play'}
                  label={video.playing ? 'Pause' : 'Play'}
                  onPress={onTogglePlay}
                  testID="viewer-play"
                />
                <ChromeButton
                  icon={video.muted ? 'volume-off' : 'volume-high'}
                  label={video.muted ? 'Unmute' : 'Mute'}
                  onPress={onToggleMute}
                  testID="viewer-mute"
                />
              </>
            )}
            <ChromeButton icon="share-variant" label="Share" onPress={onShare} size={28} testID="viewer-share" />
            <ChromeButton
              icon={favourite ? 'heart' : 'heart-outline'}
              label={favourite ? 'Remove from favourites' : 'Add to favourites'}
              onPress={onToggleFavourite}
              color={favourite ? '#ef4444' : '#fff'}
              size={28}
              testID="viewer-favourite"
            />
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  topRow: {
    position: 'absolute',
    left: 8,
    right: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  bottom: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  meta: {
    flex: 1,
    marginRight: 12,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 4,
    ...SHADOW,
  },
  resolution: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.5,
    ...SHADOW,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 30, 32, 0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  scrubber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  clock: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
    ...SHADOW,
  },
  trackHit: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    backgroundColor: '#fff',
  },
  thumb: {
    position: 'absolute',
    top: 8,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});

export default React.memo(ViewerChrome);
