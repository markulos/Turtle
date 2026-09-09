/**
 * ViewerSheet — the bottom-sheet shell the viewer's two sheets share.
 *
 * An IN-TREE overlay inside the viewer's Modal, never a second Modal (iOS
 * silently drops a sibling Modal over an open one). The parent mounts it only
 * while open, so a closed sheet costs the gesture path nothing at all. It
 * carries a high zIndex so it draws over every other overlay the viewer or
 * the gallery puts inside the Modal (chrome, share cards).
 *
 * Scrim + card. The card slides up on mount, and closes three ways: the scrim
 * tap, the Done button, and the app-wide pull-down (utils/useSheetDismiss —
 * the grab region is the whole card, the scrim fades with the drag, and a
 * committed pull slides the card off before onClose fires). `keyboard` wraps
 * the card in a KeyboardAvoidingView for the sheets that type; `topBar` is a
 * fixed row under the header (a composer / search field); `footer` a fixed
 * row at the bottom. `dark` renders the translucent-black variant with white
 * text, for a sheet that should read as part of the viewer, not the app.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSheetDismiss } from '../../../../utils/useSheetDismiss';

const SCREEN_H = Dimensions.get('window').height || 900;
const ENTER_MS = 240;
const EXIT_MS = 200;

export const DARK_SHEET = {
  card: 'rgba(18, 18, 20, 0.86)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.16)',
  handle: 'rgba(255,255,255,0.35)',
  surface: 'rgba(255,255,255,0.1)',
};

export function sheetColors(theme, dark) {
  const c = theme?.colors || {};
  if (dark) {
    return {
      ...DARK_SHEET,
      primary: c.primary || '#3b82f6',
      background: '#000',
    };
  }
  return {
    card: c.surfaceElevated || c.surface || '#1c1c1e',
    textPrimary: c.textPrimary || '#fff',
    textSecondary: c.textSecondary || 'rgba(255,255,255,0.6)',
    textMuted: c.textMuted || 'rgba(255,255,255,0.4)',
    border: c.border || 'rgba(255,255,255,0.12)',
    handle: c.border || 'rgba(255,255,255,0.25)',
    surface: c.surface || 'rgba(255,255,255,0.08)',
    primary: c.primary || '#3b82f6',
    background: c.background || '#000',
  };
}

export default function ViewerSheet({
  onClose,
  title,
  doneLabel = 'Done',
  heightRatio = 0.62,
  keyboard = false,
  dark = false,
  theme,
  topBar,
  footer,
  children,
  testID,
}) {
  const enter = useRef(new Animated.Value(SCREEN_H)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const { dragY, panHandlers, sheetDragStyle, scrollProps } = useSheetDismiss(onClose, true);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enter, { toValue: 0, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: ENTER_MS - 40, useNativeDriver: true }),
    ]).start();
  }, [enter, scrim]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(enter, { toValue: SCREEN_H, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: EXIT_MS - 20, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose?.();
    });
  }, [enter, scrim, onClose]);

  // The scrim fades with the entrance AND with a pull on the card.
  const scrimOpacity = Animated.multiply(
    scrim,
    dragY.interpolate({ inputRange: [0, SCREEN_H * 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
  );

  const colors = sheetColors(theme, dark);
  const cardHeight = Math.round(SCREEN_H * heightRatio);

  const card = (
    <Animated.View
      style={[
        styles.card,
        // Inside the KeyboardAvoidingView the card must be in NORMAL flow:
        // `padding` behaviour pads the container, and an absolutely
        // positioned child ignores its parent's padding — the card would sit
        // pinned to the bottom edge with the composer under the keyboard.
        // The wrapper's flex-end alignment keeps it at the bottom instead.
        keyboard ? styles.cardFlow : styles.cardPinned,
        // Pinned: a fixed height. In keyboard mode a CEILING instead — the
        // keyboard's padding shrinks the card rather than shoving its header
        // off the top of the screen.
        keyboard ? { maxHeight: cardHeight } : { height: cardHeight },
        { backgroundColor: colors.card },
        { transform: [{ translateY: enter }] },
      ]}
      {...panHandlers}
      testID={testID ? `${testID}-card` : undefined}
    >
      {/* Nested transforms compose: the entrance on the outer view, the drag on this one. */}
      <Animated.View style={[styles.cardInner, sheetDragStyle]}>
        <View style={[styles.handle, { backgroundColor: colors.handle }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={doneLabel} testID={testID ? `${testID}-done` : undefined}>
            <Text style={[styles.done, { color: colors.primary }]}>{doneLabel}</Text>
          </Pressable>
        </View>
        {topBar}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          scrollIndicatorInsets={{ right: 1 }}
          indicatorStyle={dark ? 'white' : 'default'}
          {...scrollProps}
        >
          {children}
        </ScrollView>
        {footer}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, dark ? styles.scrimDark : styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
        >
          {card}
        </KeyboardAvoidingView>
      ) : card}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
  },
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scrimDark: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  cardPinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardFlow: {
    width: '100%',
    flexShrink: 1,
    minHeight: 220,
  },
  cardInner: {
    flex: 1,
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  done: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 24,
  },
});
