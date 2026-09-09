/**
 * ViewerChrome — the two bands over the photo, and nothing else.
 *
 * Top: a gradient wash with Back on the left and Edit (images only) + Tags on
 * the right. Bottom: the timestamp and resolution on the left, a pill with
 * Share and Favourite on the right (plus play/pause and mute for a video).
 *
 * Deliberately flat. Both bands are `box-none` while shown, so only the
 * buttons are touch targets and every other touch falls straight through to
 * the stage; `none` while hidden, so an invisible button can never eat a
 * swipe. Opacity is ONE animated style — open progress × chrome target × the
 * pull-to-dismiss fade — with no per-element products and no measurements.
 * The old chrome multiplied four Animated values per element and toggled
 * pointerEvents from three different pieces of state; that complexity sat on
 * the exact path a swipe had to cross.
 */
import React from 'react';
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 5,
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
});

export default React.memo(ViewerChrome);
