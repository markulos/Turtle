/**
 * ViewerSheet — the bottom-sheet shell the viewer's two sheets share.
 *
 * An IN-TREE overlay inside the viewer's Modal, never a second Modal (iOS
 * silently drops a sibling Modal over an open one). The parent mounts it only
 * while open, so a closed sheet costs the gesture path nothing at all.
 *
 * Scrim + card. The card slides up on mount, and closes three ways: the scrim
 * tap, the Done button, and the app-wide pull-down (utils/useSheetDismiss —
 * the grab region is the whole card, the scrim fades with the drag, and a
 * committed pull slides the card off before onClose fires). `keyboard` wraps
 * the card in a KeyboardAvoidingView for the sheets that type.
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

export default function ViewerSheet({
  onClose,
  title,
  doneLabel = 'Done',
  heightRatio = 0.62,
  keyboard = false,
  theme,
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

  const colors = theme?.colors || {};
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
        { height: cardHeight, backgroundColor: colors.surfaceElevated || colors.surface || '#1c1c1e' },
        { transform: [{ translateY: enter }] },
      ]}
      {...panHandlers}
      testID={testID ? `${testID}-card` : undefined}
    >
      {/* Nested transforms compose: the entrance on the outer view, the drag on this one. */}
      <Animated.View style={[styles.cardInner, sheetDragStyle]}>
        <View style={[styles.handle, { backgroundColor: colors.border || 'rgba(255,255,255,0.25)' }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary || '#fff' }]}>{title}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={doneLabel} testID={testID ? `${testID}-done` : undefined}>
            <Text style={[styles.done, { color: colors.primary || '#3b82f6' }]}>{doneLabel}</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          scrollIndicatorInsets={{ right: 1 }}
          {...scrollProps}
        >
          {children}
        </ScrollView>
        {footer}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]}>
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
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  },
  cardInner: {
    flex: 1,
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
  },
  bodyContent: {
    paddingBottom: 24,
  },
});
